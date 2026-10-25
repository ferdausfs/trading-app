/**
 * MarketFeed — রিয়েল-টাইম মার্কেট ডেটা ক্লায়েন্ট (দ্বৈত মোড)
 * -------------------------------------------------------------
 * ১. Socket.IO মোড (প্রাইমারি): market-relay মিনি-সার্ভিসের মাধ্যমে Binance ডেটা
 * ২. Direct মোড (ফলব্যাক): Socket ব্যর্থ হলে ব্রাউজার সরাসরি Binance WebSocket
 *    এ সংযোগ দেয় (যেমন রিলে সার্ভার ব্লকড থাকলে)।
 *
 * ব্যবহার:
 *   const feed = getMarketFeed();
 *   feed.subscribe('BTCUSDT', '1m');
 *   const off = feed.on('kline', (d) => { ... });
 */

import { io, type Socket } from 'socket.io-client';
import type { Candle, FeedStatus, Ticker24h } from './types';

export interface LiveKline extends Candle {
  isClosed: boolean;
}

export interface KlineEvent {
  symbol: string;
  interval: string;
  kline: LiveKline;
}

type KlineHandler = (e: KlineEvent) => void;
type TickerHandler = (t: Ticker24h) => void;
type StatusHandler = (s: FeedStatus) => void;
type ErrorHandler = (e: { message: string }) => void;

const DIRECT_WS_HOSTS = [
  'wss://data-stream.binance.vision/ws',
  'wss://stream.binance.com:9443/ws',
];

const SYMBOL_RE = /^[A-Z0-9]{5,15}$/;
const VALID_INTERVALS = new Set(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']);

class MarketFeed {
  private socket: Socket | null = null;
  private directWs: WebSocket | null = null;
  private mode: 'idle' | 'socket' | 'direct' = 'idle';
  private socketBroken = false;
  private directRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private directAttempt = 0;
  private directHostIdx = 0;

  private current: { symbol: string; interval: string } | null = null;
  private status: FeedStatus = 'connecting';

  private klineHandlers = new Set<KlineHandler>();
  private tickerHandlers = new Set<TickerHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private errorHandlers = new Set<ErrorHandler>();

  private connectTimeout: ReturnType<typeof setTimeout> | null = null;

  /** নতুন সিম্বল/টাইমফ্রেম সাবস্ক্রিপশন (পুরনোটি স্বয়ংক্রিয় বাতিল) */
  subscribe(symbol: string, interval: string) {
    if (!SYMBOL_RE.test(symbol) || !VALID_INTERVALS.has(interval)) {
      this.emitError(`অবৈধ সাবস্ক্রিপশন: ${symbol} ${interval}`);
      return;
    }
    const prev = this.current;
    if (prev && prev.symbol === symbol && prev.interval === interval) return;
    this.current = { symbol, interval };

    if (this.mode === 'socket' && this.socket?.connected) {
      if (prev) this.socket.emit('market:unsubscribe', prev);
      this.socket.emit('market:subscribe', { symbol, interval });
    } else if (this.mode === 'direct') {
      this.startDirect(true);
    } else {
      this.startSocket();
    }
  }

  /** হ্যান্ডলার রেজিস্টার → আনরেজিস্টার ফাংশন রিটার্ন করে */
  on(event: 'kline', cb: KlineHandler): () => void;
  on(event: 'ticker', cb: TickerHandler): () => void;
  on(event: 'status', cb: StatusHandler): () => void;
  on(event: 'error', cb: ErrorHandler): () => void;
  on(event: string, cb: unknown): () => void {
    const set =
      event === 'kline' ? this.klineHandlers
      : event === 'ticker' ? this.tickerHandlers
      : event === 'status' ? this.statusHandlers
      : this.errorHandlers;
    set.add(cb as never);
    return () => set.delete(cb as never);
  }

  getStatus(): FeedStatus {
    return this.status;
  }

  private setStatus(s: FeedStatus) {
    if (this.status === s) return;
    this.status = s;
    this.statusHandlers.forEach((h) => h(s));
  }

  private emitError(message: string) {
    this.errorHandlers.forEach((h) => h({ message }));
  }

  // ---------- Socket.IO মোড ----------
  private startSocket() {
    if (this.socketBroken) {
      this.startDirect(true);
      return;
    }
    this.mode = 'socket';
    this.setStatus('connecting');

    if (!this.socket) {
      // Caddy গেটওয়ে নিয়ম: পোর্ট কখনো URL এ নয়, সবসময় XTransformPort কোয়েরিতে
      this.socket = io('/?XTransformPort=3003', {
        path: '/',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 1000,
        timeout: 8000,
      });

      this.socket.on('connect', () => {
        if (this.connectTimeout) { clearTimeout(this.connectTimeout); this.connectTimeout = null; }
        this.directAttempt = 0;
        if (this.mode === 'socket') {
          this.setStatus('live');
          const cur = this.current;
          if (cur) this.socket!.emit('market:subscribe', cur);
        }
      });

      this.socket.on('market:upstream', (d: { connected: boolean }) => {
        if (this.mode !== 'socket') return;
        this.setStatus(d.connected ? 'live' : 'connecting');
      });

      this.socket.on('market:kline', (e: KlineEvent) => {
        if (this.mode !== 'socket') return;
        this.klineHandlers.forEach((h) => h(e));
      });

      this.socket.on('market:ticker', (t: Ticker24h) => {
        if (this.mode !== 'socket') return;
        this.tickerHandlers.forEach((h) => h(t));
      });

      this.socket.on('market:error', (d: { message: string }) => this.emitError(d.message));

      this.socket.on('connect_error', () => {
        // প্রথম connect_error এই ফলব্যাক ট্রিগার করবে
        this.failoverToDirect('রিলে সার্ভারে সংযোগ করা যাচ্ছে না');
      });

      // ৮ সেকেন্ডের মধ্যে কানেক্ট না হলে ফলব্যাক
      this.connectTimeout = setTimeout(() => {
        if (!this.socket?.connected) this.failoverToDirect('সংযোগের সময় শেষ');
      }, 8000);
    }

    const cur = this.current;
    if (cur && this.socket.connected) this.socket.emit('market:subscribe', cur);
  }

  private failoverToDirect(reason: string) {
    if (this.mode === 'direct') return;
    console.warn(`[feed] Socket.IO মোড ব্যর্থ (${reason}) — Direct Binance WebSocket মোডে যাচ্ছি`);
    this.socketBroken = true;
    if (this.connectTimeout) { clearTimeout(this.connectTimeout); this.connectTimeout = null; }
    try { this.socket?.disconnect(); } catch {}
    this.socket = null;
    this.startDirect(true);
  }

  // ---------- Direct Binance WS মোড ----------
  private startDirect(immediate = false) {
    this.mode = 'direct';
    if (this.directRetryTimer) { clearTimeout(this.directRetryTimer); this.directRetryTimer = null; }
    if (!immediate) {
      // এক্সপোনেনশিয়াল ব্যাকঅফ: ১s, ২s, ৪s … সর্বোচ্চ ১৫s
      const delay = Math.min(15_000, 1000 * Math.pow(2, this.directAttempt));
      this.directAttempt += 1;
      this.directRetryTimer = setTimeout(() => this.startDirect(true), delay);
      return;
    }
    this.closeDirect();
    this.setStatus('connecting');

    const cur = this.current;
    if (!cur) return;

    const host = DIRECT_WS_HOSTS[this.directHostIdx % DIRECT_WS_HOSTS.length];
    this.directHostIdx += 1;

    try {
      const ws = new WebSocket(host);
      this.directWs = ws;

      ws.onopen = () => {
        this.directAttempt = 0;
        this.setStatus('live');
        ws.send(JSON.stringify({
          method: 'SUBSCRIBE',
          params: [
            `${cur.symbol.toLowerCase()}@kline_${cur.interval}`,
            `${cur.symbol.toLowerCase()}@miniTicker`,
          ],
          id: 1,
        }));
      };

      ws.onmessage = (ev: MessageEvent) => {
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(String(ev.data)); } catch { return; }
        const e = msg.e as string | undefined;
        if (e === 'kline') {
          const k = msg.k as Record<string, unknown>;
          const kline: LiveKline = {
            time: Math.floor(Number(k.t) / 1000),
            open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v,
            isClosed: Boolean(k.x),
          };
          this.klineHandlers.forEach((h) => h({ symbol: String(msg.s), interval: String(k.i), kline }));
        } else if (e === '24hrMiniTicker') {
          const open = +msg.o;
          const last = +msg.c;
          this.tickerHandlers.forEach((h) => h({
            symbol: String(msg.s),
            last,
            open,
            high: +msg.h,
            low: +msg.l,
            changePercent: open > 0 ? ((last - open) / open) * 100 : 0,
            quoteVolume: +msg.q,
          }));
        }
      };

      ws.onclose = () => {
        if (this.mode === 'direct' && this.directWs === ws) {
          this.setStatus('offline');
          this.startDirect(false); // ব্যাকঅফ সহ পুনঃসংযোগ
        }
      };

      ws.onerror = () => {
        // onclose রিকানেক্ট সামলাবে
      };
    } catch {
      this.setStatus('offline');
      this.startDirect(false);
    }
  }

  private closeDirect() {
    if (this.directWs) {
      const ws = this.directWs;
      this.directWs = null;
      try {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.close();
      } catch {}
    }
  }
}

/** গ্লোবাল সিঙ্গেলটন (HMR/re-render এও একই কানেকশন থাকে) */
const globalForFeed = globalThis as unknown as { marketFeed?: MarketFeed };

export function getMarketFeed(): MarketFeed {
  if (!globalForFeed.marketFeed) globalForFeed.marketFeed = new MarketFeed();
  return globalForFeed.marketFeed;
}
