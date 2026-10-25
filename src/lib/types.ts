/**
 * TradeLite — শেয়ার্ড টাইপ ও কনস্ট্যান্ট
 * ফ্রন্টএন্ড ও ব্যাকএন্ড উভয় জায়গায় ব্যবহৃত।
 */

/** একটি ক্যান্ডেল (OHLCV) — time হলো ইউনিক্স সেকেন্ড */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** ২৪ ঘণ্টার মার্কেট স্ট্যাটিসটিক্স */
export interface Ticker24h {
  symbol: string;
  last: number;
  open: number;
  high: number;
  low: number;
  changePercent: number;
  quoteVolume: number;
}

/** সাপোর্টেড টাইমফ্রেম */
export type Timeframe =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h'
  | '1d' | '1w';

export const TIMEFRAMES: Timeframe[] = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w'];

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '1m': '১ মিনিট',
  '3m': '৩ মিনিট',
  '5m': '৫ মিনিট',
  '15m': '১৫ মিনিট',
  '30m': '৩০ মিনিট',
  '1h': '১ ঘণ্টা',
  '2h': '২ ঘণ্টা',
  '4h': '৪ ঘণ্টা',
  '1d': '১ দিন',
  '1w': '১ সপ্তাহ',
};

/** জনপ্রিয় ক্রিপ্টো পেয়ার (Binance) */
export const DEFAULT_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT',
  'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT',
  'LINKUSDT', 'TRXUSDT', 'DOTUSDT', 'LTCUSDT',
] as const;

export const SYMBOL_LABELS: Record<string, string> = {
  BTCUSDT: 'Bitcoin',
  ETHUSDT: 'Ethereum',
  BNBUSDT: 'BNB',
  SOLUSDT: 'Solana',
  XRPUSDT: 'XRP',
  DOGEUSDT: 'Dogecoin',
  ADAUSDT: 'Cardano',
  AVAXUSDT: 'Avalanche',
  LINKUSDT: 'Chainlink',
  TRXUSDT: 'TRON',
  DOTUSDT: 'Polkadot',
  LTCUSDT: 'Litecoin',
};

/** ইন্ডিকেটর কী ও প্যারামিটার */
export type IndicatorKey = 'ema' | 'bb' | 'rsi' | 'macd';

export interface EmaParams { periods: [number, number] }   // ডিফল্ট [20, 50]
export interface BbParams { period: number; mult: number }  // ডিফল্ট 20, 2
export interface RsiParams { period: number }               // ডিফল্ট 14
export interface MacdParams { fast: number; slow: number; signal: number } // ডিফল্ট 12, 26, 9

export interface IndicatorSetting {
  key: IndicatorKey;
  enabled: boolean;
  params: EmaParams | BbParams | RsiParams | MacdParams;
}

export type IndicatorConfigMap = Record<IndicatorKey, IndicatorSetting>;

export const DEFAULT_INDICATOR_CONFIG: IndicatorConfigMap = {
  ema:  { key: 'ema',  enabled: true,  params: { periods: [20, 50] } },
  bb:   { key: 'bb',   enabled: false, params: { period: 20, mult: 2 } },
  rsi:  { key: 'rsi',  enabled: true,  params: { period: 14 } },
  macd: { key: 'macd', enabled: true,  params: { fast: 12, slow: 26, signal: 9 } },
};

export const INDICATOR_LABELS: Record<IndicatorKey, string> = {
  ema: 'EMA (এক্সপোনেনশিয়াল মুভিং এভারেজ)',
  bb: 'Bollinger Bands',
  rsi: 'RSI (রিলেটিভ স্ট্রেংথ ইনডেক্স)',
  macd: 'MACD',
};

/** ফিড কানেকশন স্টেটাস */
export type FeedStatus = 'connecting' | 'live' | 'offline';
