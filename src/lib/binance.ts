/**
 * Binance REST API হেল্পার — হোস্ট ফলব্যাক, টাইমআউট, ক্যাশ ও নরমালাইজেশন।
 *
 * নোট: Binance পাবলিক মার্কেট ডেটার জন্য API key ছাড়াই কাজ করে।
 * data-api.binance.vision হলো Binance-এর অফিসিয়াল পাবলিক মার্কেট-ডেটা হোস্ট।
 */

import type { Candle, Ticker24h } from './types';

export const VALID_INTERVALS = [
  '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M',
] as const;

export type ValidInterval = (typeof VALID_INTERVALS)[number];

const SYMBOL_RE = /^[A-Z0-9]{5,15}$/;

export function isValidSymbol(symbol: string): boolean {
  return SYMBOL_RE.test(symbol);
}

export function isValidInterval(interval: string): interval is ValidInterval {
  return (VALID_INTERVALS as readonly string[]).includes(interval);
}

/** REST হোস্ট পছন্দসই ক্রমে; সফল হোস্ট মনে রাখা হয় */
const REST_HOSTS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
];

let preferredHostIdx = 0;

export class BinanceApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'BinanceApiError';
  }
}

/** সমস্ত হোস্টে চেষ্টা করে প্রথম সফল JSON রেসপন্স দেয় */
async function fetchJson<T>(path: string, timeoutMs = 8000): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < REST_HOSTS.length; i++) {
    const hostIdx = (preferredHostIdx + i) % REST_HOSTS.length;
    const url = `${REST_HOSTS[hostIdx]}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) {
        lastError = new BinanceApiError(
          `Binance ${res.status}: ${res.statusText}`,
          res.status
        );
        continue;
      }
      preferredHostIdx = hostIdx; // সফল হোস্ট পরবর্তীতে প্রথমে চেষ্টা হবে
      return (await res.json()) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new BinanceApiError('সব Binance হোস্ট ব্যর্থ হয়েছে');
}

/** ইন-মেমরি TTL ক্যাশ (একক সার্ভার ইনস্ট্যান্সের জন্য যথেষ্ট) */
const cache = new Map<string, { data: unknown; expiresAt: number }>();

export function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function cacheSet(key: string, data: unknown, ttlMs: number): void {
  // ক্যাশ সাইজ সীমা: 300 এন্ট্রি (LRU আনুমানিক)
  if (cache.size > 300) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/** Binance kline অ্যারে → Candle */
function toCandle(k: unknown[]): Candle {
  return {
    time: Math.floor(Number(k[0]) / 1000),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  };
}

export interface KlinesOptions {
  symbol: string;
  interval: ValidInterval;
  limit: number;
  endTime?: number;
}

/** ঐতিহাসিক ক্যান্ডেল ডেটা (২০ সেকেন্ড ক্যাশ) */
export async function fetchKlines(opts: KlinesOptions): Promise<Candle[]> {
  const { symbol, interval, limit, endTime } = opts;
  const cacheKey = `klines:${symbol}:${interval}:${limit}:${endTime ?? 'latest'}`;
  const cached = cacheGet<Candle[]>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    symbol,
    interval,
    limit: String(limit),
  });
  if (endTime) params.set('endTime', String(endTime));

  const raw = await fetchJson<unknown[][]>(`/api/v3/klines?${params.toString()}`);
  const candles = raw.map(toCandle);
  cacheSet(cacheKey, candles, 20_000);
  return candles;
}

/** ২৪ ঘণ্টার টিকার পরিসংখ্যান (এক বা একাধিক সিম্বল, ১০ সেকেন্ড ক্যাশ) */
export async function fetchTickers(symbols: string[]): Promise<Ticker24h[]> {
  const cacheKey = `tickers:${symbols.slice().sort().join(',')}`;
  const cached = cacheGet<Ticker24h[]>(cacheKey);
  if (cached) return cached;

  const query =
    symbols.length === 1
      ? `symbol=${symbols[0]}`
      : `symbols=${encodeURIComponent(JSON.stringify(symbols))}`;

  interface RawTicker {
    symbol: string;
    lastPrice: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    priceChangePercent: string;
    quoteVolume: string;
  }

  const raw = await fetchJson<RawTicker | RawTicker[]>(`/api/v3/ticker/24hr?${query}`);
  const list = Array.isArray(raw) ? raw : [raw];
  const tickers = list.map((t) => ({
    symbol: t.symbol,
    last: Number(t.lastPrice),
    open: Number(t.openPrice),
    high: Number(t.highPrice),
    low: Number(t.lowPrice),
    changePercent: Number(t.priceChangePercent),
    quoteVolume: Number(t.quoteVolume),
  }));
  cacheSet(cacheKey, tickers, 10_000);
  return tickers;
}
