/**
 * GET /api/market/ticker?symbols=BTCUSDT,ETHUSDT
 * ২৪ ঘণ্টার মার্কেট পরিসংখ্যান — ওয়াচলিস্ট মিনি-টিকার ও মেইন টিকারের জন্য।
 */

import { NextResponse } from 'next/server';
import { fetchTickers, isValidSymbol, BinanceApiError } from '@/lib/binance';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const rl = rateLimit(`ticker:${clientIp(req)}`, 120, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: `অনেক বেশি অনুরোধ। ${rl.retryAfterSec}s পরে আবার চেষ্টা করুন।` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('symbols') ?? 'BTCUSDT';
  const symbols = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0 || symbols.length > 20) {
    return NextResponse.json(
      { success: false, error: '১ থেকে ২০টি সিম্বল দিন' },
      { status: 400 }
    );
  }
  const invalid = symbols.find((s) => !isValidSymbol(s));
  if (invalid) {
    return NextResponse.json(
      { success: false, error: `অবৈধ symbol: ${invalid}` },
      { status: 400 }
    );
  }

  try {
    const tickers = await fetchTickers(symbols);
    return NextResponse.json(
      { success: true, data: tickers },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    const status = err instanceof BinanceApiError && err.status === 400 ? 400 : 502;
    console.error('[api/ticker] ত্রুটি:', err);
    return NextResponse.json(
      {
        success: false,
        error: status === 400 ? 'সিম্বল পাওয়া যায়নি' : 'মার্কেট ডেটা সার্ভারে পৌঁছানো যাচ্ছে না',
      },
      { status }
    );
  }
}
