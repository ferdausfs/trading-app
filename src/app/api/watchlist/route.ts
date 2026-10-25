/**
 * ওয়াচলিস্ট CRUD — Prisma + SQLite
 *   GET    /api/watchlist          → সব সিম্বল (খালি হলে ডিফল্ট সিড)
 *   POST   /api/watchlist {symbol} → নতুন সিম্বল যোগ
 *   DELETE /api/watchlist?symbol=X → সিম্বল মুছুন
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidSymbol } from '@/lib/binance';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** প্রথমবার ব্যবহারে সিড ডেটা */
const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];

async function ensureSeeded() {
  const count = await db.watchlistItem.count();
  if (count === 0) {
    await db.watchlistItem.createMany({
      data: DEFAULT_WATCHLIST.map((symbol) => ({ symbol })),
    });
  }
}

export async function GET() {
  try {
    await ensureSeeded();
    const items = await db.watchlistItem.findMany({
      orderBy: { createdAt: 'asc' },
      select: { symbol: true, createdAt: true },
    });
    return NextResponse.json({ success: true, data: items });
  } catch (err) {
    console.error('[api/watchlist GET] ত্রুটি:', err);
    return NextResponse.json(
      { success: false, error: 'ওয়াচলিস্ট লোড করা যায়নি' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const rl = rateLimit(`watchlist-w:${clientIp(req)}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: 'অনেক বেশি অনুরোধ' }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => null);
    const symbol = String(body?.symbol ?? '').toUpperCase().trim();

    if (!isValidSymbol(symbol)) {
      return NextResponse.json(
        { success: false, error: `অবৈধ সিম্বল ফরম্যাট: ${symbol}` },
        { status: 400 }
      );
    }

    // Binance-এ সিম্বলটি আসলেই আছে কিনা যাচাই
    const { fetchTickers } = await import('@/lib/binance');
    try {
      await fetchTickers([symbol]);
    } catch {
      return NextResponse.json(
        { success: false, error: `সিম্বলটি Binance-এ পাওয়া যায়নি: ${symbol}` },
        { status: 400 }
      );
    }

    const item = await db.watchlistItem.upsert({
      where: { symbol },
      update: {},
      create: { symbol },
    });
    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (err) {
    console.error('[api/watchlist POST] ত্রুটি:', err);
    return NextResponse.json(
      { success: false, error: 'সিম্বল যোগ করা যায়নি' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const rl = rateLimit(`watchlist-w:${clientIp(req)}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: 'অনেক বেশি অনুরোধ' }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get('symbol') ?? '').toUpperCase();
    if (!symbol) {
      return NextResponse.json({ success: false, error: 'symbol কোয়েরি প্যারাম দিন' }, { status: 400 });
    }
    await db.watchlistItem.deleteMany({ where: { symbol } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/watchlist DELETE] ত্রুটি:', err);
    return NextResponse.json(
      { success: false, error: 'সিম্বল মুছা যায়নি' },
      { status: 500 }
    );
  }
}
