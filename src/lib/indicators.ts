/**
 * TradeLite — ইন্ডিকেটর গণনা লাইব্রেরি (pure functions)
 * -----------------------------------------------------
 * সব ফাংশন নির্ভরমুক্ত (dependency-free), তাই ব্রাউজার, Web Worker
 * এবং React Native — সব জায়গায় একইভাবে চলে।
 *
 * রেফারেন্স সূত্র:
 *   EMA:  EMA = (Close − EMA_prev) × k + EMA_prev,  k = 2 / (period + 1)
 *   RSI:  100 − 100 / (1 + RS),  RS = AvgGain / AvgLoss  (Wilder smoothing)
 *   MACD: 12-EMA − 26-EMA, Signal = 9-EMA(MACD), Hist = MACD − Signal
 *   BB:   Middle = SMA(20), ± mult × StdDev
 */

import type { Candle } from './types';

export type NullableSeries = (number | null)[];

/** ক্লোজ প্রাইসের অ্যারে বের করে */
export function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close);
}

/**
 * Simple Moving Average — Bollinger Bands এর ভিত্তি।
 * প্রথম (period − 1) ইনডেক্সে null, তারপর প্রতিটি উইন্ডোর গড়।
 */
export function sma(values: number[], period: number): NullableSeries {
  const out: NullableSeries = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/**
 * Exponential Moving Average — SMA seed দিয়ে শুরু হয় (ট্রেডিং প্ল্যাটফর্মের স্ট্যান্ডার্ড)।
 */
export function ema(values: number[], period: number): NullableSeries {
  const out: NullableSeries = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period; // SMA seed
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = (values[i] - prev) * k + prev;
    out[i] = prev;
  }
  return out;
}

/**
 * Relative Strength Index — Wilder এর স্মুদিং পদ্ধতি।
 * বিশেষ কেস: avgGain = avgLoss = 0 (সম্পূর্ণ সমতল) → RSI = 50 (নিউট্রাল);
 * শুধু avgLoss = 0 (শুধু বৃদ্ধি) → RSI = 100।
 */
export function rsi(values: number[], period = 14): NullableSeries {
  const out: NullableSeries = new Array(values.length).fill(null);
  if (period <= 0 || values.length <= period) return out;

  const rsiFrom = (avgGain: number, avgLoss: number): number => {
    if (avgLoss === 0 && avgGain === 0) return 50;
    if (avgLoss === 0) return 100;
    return 100 - 100 / (1 + avgGain / avgLoss);
  };

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = rsiFrom(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = rsiFrom(avgGain, avgLoss);
  }
  return out;
}

export interface MacdResult {
  macd: NullableSeries;
  signal: NullableSeries;
  histogram: NullableSeries;
}

/**
 * Moving Average Convergence Divergence।
 * MACD লাইন = fast-EMA − slow-EMA; Signal = MACD লাইনের signal-EMA।
 */
export function macd(values: number[], fast = 12, slow = 26, signal = 9): MacdResult {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine: NullableSeries = values.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? (emaFast[i] as number) - (emaSlow[i] as number) : null
  );

  const signalLine: NullableSeries = new Array(values.length).fill(null);
  const firstIdx = macdLine.findIndex((v) => v != null);
  if (firstIdx >= 0) {
    const compact = (macdLine.slice(firstIdx) as number[]);
    const sig = ema(compact, signal);
    for (let i = 0; i < sig.length; i++) signalLine[firstIdx + i] = sig[i];
  }

  const histogram: NullableSeries = macdLine.map((v, i) =>
    v != null && signalLine[i] != null ? v - (signalLine[i] as number) : null
  );

  return { macd: macdLine, signal: signalLine, histogram };
}

export interface BollingerResult {
  upper: NullableSeries;
  middle: NullableSeries;
  lower: NullableSeries;
}

/**
 * Bollinger Bands — Middle = SMA(period), উপরে/নিচে mult × population StdDev।
 */
export function bollinger(values: number[], period = 20, mult = 2): BollingerResult {
  const upper: NullableSeries = new Array(values.length).fill(null);
  const middle: NullableSeries = new Array(values.length).fill(null);
  const lower: NullableSeries = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return { upper, middle, lower };

  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    const mean = sum / period;
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j] - mean;
      sq += d * d;
    }
    const sd = Math.sqrt(sq / period);
    middle[i] = mean;
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { upper, middle, lower };
}

/**
 * সিরিজ + টাইমস্ট্যাম্প → lightweight-charts পয়েন্ট অ্যারে।
 * null মান বাদ দেওয়া হয় (চার্টে ফাঁক দেখাবে না)।
 */
export function toLinePoints(
  times: number[],
  series: NullableSeries
): { time: number; value: number }[] {
  const pts: { time: number; value: number }[] = [];
  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    if (v != null) pts.push({ time: times[i], value: v });
  }
  return pts;
}
