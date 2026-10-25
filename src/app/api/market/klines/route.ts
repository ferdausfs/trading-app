/**
 * GET /api/market/klines?symbol=BTCUSDT&interval=1m&limit=500
 * Binance ঐতিহাসিক ক্যান্ডেল ডেটার প্রক্সি (ক্যাশ + ভ্যালিডেশন + rate limit সহ)।
 */

import { NextResponse } from 'next/server';
import {
  fetchKlines,
  isValidInterval,
  isValidSymbol,
  BinanceApiError,
} from '@/lib/binance';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Rate limit: প্রতি IP তে মিনিটে ৬০ অনুরোধ
  const rl = rateLimit(`klines:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: `অনেক বেশি অনুরোধ। ${rl.retryAfterSec}s পরে আবার চেষ্টা করুন।` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') ?? '').toUpperCase();
  const interval = searchParams.get('interval') ?? '1m';
  const limitRaw = searchParams.get('limit') ?? '500';

  // ভ্যালিডেশন
  if (!isValidSymbol(symbol)) {
    return NextResponse.json(
      { success: false, error: `অবৈধ symbol: ${symbol}` },
      { status: 400 }
    );
  }
  if (!isValidInterval(interval)) {
    return NextResponse.json(
      { success: false, error: `অবৈধ interval: ${interval}` },
      { status: 400 }
    );
  }
  let limit = Number(limitRaw);
  if (!Number.isFinite(limit)) limit = 500;
  limit = Math.min(1000, Math.max(50, Math.floor(limit)));

  try {
    const candles = await fetchKlines({ symbol, interval, limit });
    return NextResponse.json(
      { success: true, data: candles, count: candles.length },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    const status = err instanceof BinanceApiError && err.status === 400 ? 400 : 502;
    console.error('[api/klines] ত্রুটি:', err);
    return NextResponse.json(
      {
        success: false,
        error: status === 400 ? `সিম্বল পাওয়া যায়নি: ${symbol}` : 'মার্কেট ডেটা সার্ভারে পৌঁছানো যাচ্ছে না',
      },
      { status }
    );
  }
}
