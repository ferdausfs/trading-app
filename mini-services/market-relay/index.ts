/**
 * Market Relay Service — Socket.IO + Binance WebSocket Bridge
 * ------------------------------------------------------------
 * এই মিনি-সার্ভিস একটি মাত্র upstream Binance WebSocket কানেকশন ব্যবহার করে
 * একাধিক ক্লায়েন্টের সাবস্ক্রিপশন শেয়ার করে (ref-counting ভিত্তিক)।
 *
 * ক্লায়েন্ট ইভেন্ট:
 *   market:subscribe   { symbol: "BTCUSDT", interval: "1m" }
 *   market:unsubscribe { symbol: "BTCUSDT", interval: "1m" }
 *
 * সার্ভার ইভেন্ট:
 *   market:kline    { symbol, interval, kline: { time, open, high, low, close, volume, isClosed } }
 *   market:ticker   { symbol, last, open, high, low, changePercent, quoteVolume }
 *   market:upstream { connected: boolean }   // Binance কানেকশন স্টেটাস
 *   market:error    { message: string }
 */

import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT = 3003;

// ---------- ভ্যালিডেশন ----------
const SYMBOL_RE = /^[A-Z0-9]{5,15}$/;
const VALID_INTERVALS = new Set([
  '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M',
]);

// ---------- Binance Upstream Manager ----------
const BINANCE_HOSTS = [
  'wss://data-stream.binance.vision/ws', // পাবলিক মার্কেট-ডেটা এন্ডপয়েন্ট (জিও-ব্লক ফ্রেন্ডলি)
  'wss://stream.binance.com:9443/ws',    // ফলব্যাক
];

class BinanceUpstream {
  private ws: WebSocket | null = null;
  private reqId = 1;
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessageAt = 0;
  private hostIdx = 0;
  public connected = false;
  /** এই মুহূর্তে upstream এ সাবস্ক্রাইবড স্ট্রিমগুলো (reconnect এ পুনঃসাবস্ক্রাইব হয়) */
  public activeStreams = new Set<string>();

  public onKline: (msg: any) => void = () => {};
  public onTicker: (msg: any) => void = () => {};
  public onStatus: (connected: boolean) => void = () => {};

  connect() {
    if (this.ws) return;
    const host = BINANCE_HOSTS[this.hostIdx % BINANCE_HOSTS.length];
    try {
      this.ws = new WebSocket(host);
    } catch (err) {
      console.error('[upstream] WebSocket তৈরিতে ব্যর্থ:', err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log(`[upstream] সংযুক্ত: ${host}`);
      this.connected = true;
      this.attempts = 0;
      this.lastMessageAt = Date.now();
      // পুরনো সব স্ট্রিম পুনঃসাবস্ক্রাইব করুন
      if (this.activeStreams.size > 0) {
        this.send('SUBSCRIBE', Array.from(this.activeStreams));
      }
      this.onStatus(true);
      this.startStaleWatch();
    };

    this.ws.onmessage = (ev: MessageEvent) => {
      this.lastMessageAt = Date.now();
      let msg: any;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.e === 'kline') this.onKline(msg);
      else if (msg.e === '24hrMiniTicker') this.onTicker(msg);
      // subscribe/unsubscribe ack (result === null) উপেক্ষা করা হয়
    };

    this.ws.onclose = (ev: CloseEvent) => {
      console.warn(`[upstream] বিচ্ছিন্ন (code=${ev.code})`);
      this.cleanup();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose এর পর স্বয়ংক্রিয়ভাবে reconnect হবে; পরবর্তীবার অন্য হোস্ট ট্রাই হবে
      this.hostIdx += 1;
    };
  }

  private cleanup() {
    this.connected = false;
    if (this.ws) {
      try {
        this.ws.onclose = null as any;
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.stopStaleWatch();
    this.onStatus(false);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(15000, 1000 * Math.pow(2, this.attempts));
    this.attempts += 1;
    console.log(`[upstream] ${delay}ms পরে পুনঃসংযোগের চেষ্টা (#${this.attempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /** ৯০ সেকেন্ডের বেশি কোনো মেসেজ না এলে জোরপূর্বক রিকানেক্ট */
  private startStaleWatch() {
    this.stopStaleWatch();
    this.staleTimer = setInterval(() => {
      if (this.connected && this.activeStreams.size > 0 && Date.now() - this.lastMessageAt > 90_000) {
        console.warn('[upstream] Stale connection detected, restarting...');
        try {
          this.ws?.close();
        } catch {}
      }
    }, 30_000);
  }

  private stopStaleWatch() {
    if (this.staleTimer) {
      clearInterval(this.staleTimer);
      this.staleTimer = null;
    }
  }

  private send(method: 'SUBSCRIBE' | 'UNSUBSCRIBE', params: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || params.length === 0) return;
    // Binance সীমা: এক মেসেজে সর্বোচ্চ ১০০টি প্যারাম; ১০ মেসেজ/সেকেন্ড
    for (let i = 0; i < params.length; i += 100) {
      const chunk = params.slice(i, i + 100);
      this.ws.send(JSON.stringify({ method, params: chunk, id: this.reqId++ }));
    }
  }

  addStreams(names: string[]) {
    const fresh = names.filter((n) => !this.activeStreams.has(n));
    fresh.forEach((n) => this.activeStreams.add(n));
    if (this.connected) this.send('SUBSCRIBE', fresh);
  }

  removeStreams(names: string[]) {
    const existing = names.filter((n) => this.activeStreams.has(n));
    existing.forEach((n) => this.activeStreams.delete(n));
    if (this.connected) this.send('UNSUBSCRIBE', existing);
  }

  /** পরীক্ষার জন্য */
  ping() {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }
}

// ---------- Socket.IO সেটআপ ----------
const httpServer = createServer();
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const upstream = new BinanceUpstream();

upstream.onKline = (msg) => {
  const k = msg.k;
  io.to(`kline:${msg.s}:${k.i}`).emit('market:kline', {
    symbol: msg.s,
    interval: k.i,
    kline: {
      time: Math.floor(k.t / 1000),
      open: +k.o,
      high: +k.h,
      low: +k.l,
      close: +k.c,
      volume: +k.v,
      isClosed: Boolean(k.x),
    },
    eventTime: msg.E,
  });
};

upstream.onTicker = (msg) => {
  const open = +msg.o;
  const last = +msg.c;
  io.to(`ticker:${msg.s}`).emit('market:ticker', {
    symbol: msg.s,
    last,
    open,
    high: +msg.h,
    low: +msg.l,
    changePercent: open > 0 ? ((last - open) / open) * 100 : 0,
    quoteVolume: +msg.q,
    eventTime: msg.E,
  });
};

upstream.onStatus = (connected) => {
  io.emit('market:upstream', { connected });
};

/** স্ট্রিম রেফারেন্স কাউন্টিং: stream → socket id সেট */
const streamRefs = new Map<string, Set<string>>();

function streamsFor(symbol: string, interval: string): string[] {
  const s = symbol.toLowerCase();
  return [`${s}@kline_${interval}`, `${s}@miniTicker`];
}

function releaseSocketRefs(socketId: string) {
  for (const [stream, owners] of streamRefs) {
    if (!owners.has(socketId)) continue;
    owners.delete(socketId);
    if (owners.size === 0) {
      streamRefs.delete(stream);
      upstream.removeStreams([stream]);
      console.log(`[relay] স্ট্রিম আনসাবস্ক্রাইব: ${stream}`);
    }
  }
}

io.on('connection', (socket) => {
  // প্রতিটি সকেটের সক্রিয় সাবস্ক্রিপশন: "SYMBOL:interval" সেট
  socket.data.subs = new Set<string>();
  console.log(`[relay] ক্লায়েন্ট সংযুক্ত: ${socket.id} (মোট: ${io.engine.clientsCount})`);

  socket.emit('market:upstream', { connected: upstream.connected });

  socket.on('market:subscribe', (payload: { symbol?: string; interval?: string }) => {
    const symbol = String(payload?.symbol ?? '').toUpperCase();
    const interval = String(payload?.interval ?? '');
    if (!SYMBOL_RE.test(symbol) || !VALID_INTERVALS.has(interval)) {
      socket.emit('market:error', { message: `অবৈধ symbol বা interval: ${symbol} / ${interval}` });
      return;
    }

    const key = `${symbol}:${interval}`;
    if ((socket.data.subs as Set<string>).has(key)) return;
    (socket.data.subs as Set<string>).add(key);

    const streams = streamsFor(symbol, interval);
    streams.forEach((st) => {
      if (!streamRefs.has(st)) streamRefs.set(st, new Set());
      streamRefs.get(st)!.add(socket.id);
    });
    socket.join(`kline:${symbol}:${interval}`);
    socket.join(`ticker:${symbol}`);
    upstream.addStreams(streams);
    console.log(`[relay] ${socket.id} → ${key} সাবস্ক্রাইব (streams: ${upstream.activeStreams.size})`);
  });

  socket.on('market:unsubscribe', (payload: { symbol?: string; interval?: string }) => {
    const symbol = String(payload?.symbol ?? '').toUpperCase();
    const interval = String(payload?.interval ?? '');
    const key = `${symbol}:${interval}`;
    if (!(socket.data.subs as Set<string>).has(key)) return;
    (socket.data.subs as Set<string>).delete(key);
    socket.leave(`kline:${symbol}:${interval}`);
    socket.leave(`ticker:${symbol}`);
    releaseOneSocketRef(socket.id, streamsFor(symbol, interval));
  });

  socket.on('market:ping', (cb: (pong: { upstream: boolean; t: number }) => void) => {
    if (typeof cb === 'function') cb({ upstream: upstream.connected, t: Date.now() });
  });

  socket.on('disconnect', () => {
    (socket.data.subs as Set<string>).clear();
    releaseSocketRefs(socket.id);
    console.log(`[relay] ক্লায়েন্ট বিচ্ছিন্ন: ${socket.id} (মোট: ${io.engine.clientsCount})`);
  });

  socket.on('error', (err) => {
    console.error(`[relay] সকেট ত্রুটি (${socket.id}):`, err);
  });
});

function releaseOneSocketRef(socketId: string, streams: string[]) {
  for (const stream of streams) {
    const owners = streamRefs.get(stream);
    if (!owners || !owners.has(socketId)) continue;
    owners.delete(socketId);
    if (owners.size === 0) {
      streamRefs.delete(stream);
      upstream.removeStreams([stream]);
    }
  }
}

httpServer.listen(PORT, () => {
  console.log(`Market relay (Socket.IO) চলছে পোর্ট ${PORT} এ`);
  upstream.connect();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM প্রাপ্ত, সার্ভার বন্ধ হচ্ছে...');
  httpServer.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('SIGINT প্রাপ্ত, সার্ভার বন্ধ হচ্ছে...');
  httpServer.close(() => process.exit(0));
});
