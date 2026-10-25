/**
 * ইন্ডিকেটর গণনা — ওয়েব ভার্সনের (src/lib/indicators.ts) React Native অনুলিপি।
 * ওয়েব ও মোবাইলে একই সূত্র ব্যবহৃত হয় (লজিক রিইউজ — স্পেসিফিকেশন ফেজ ৩)।
 */

export function ema(values, period) {
  const out = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = (values[i] - prev) * k + prev;
    out[i] = prev;
  }
  return out;
}

export function rsi(values, period = 14) {
  const out = new Array(values.length).fill(null);
  if (period <= 0 || values.length <= period) return out;

  const rsiFrom = (avgGain, avgLoss) => {
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

export function macd(values, fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = values.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null
  );
  const signalLine = new Array(values.length).fill(null);
  const firstIdx = macdLine.findIndex((v) => v != null);
  if (firstIdx >= 0) {
    const compact = macdLine.slice(firstIdx);
    const sig = ema(compact, signal);
    for (let i = 0; i < sig.length; i++) signalLine[firstIdx + i] = sig[i];
  }
  const histogram = macdLine.map((v, i) =>
    v != null && signalLine[i] != null ? v - signalLine[i] : null
  );
  return { macd: macdLine, signal: signalLine, histogram };
}

export function bollinger(values, period = 20, mult = 2) {
  const upper = new Array(values.length).fill(null);
  const middle = new Array(values.length).fill(null);
  const lower = new Array(values.length).fill(null);
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
