/**
 * ইন্ডিকেটর কনফিগারেশন — Prisma + SQLite
 *   GET /api/indicators → সব ইন্ডিকেটর সেটিংস (খালি হলে ডিফল্ট সিড)
 *   PUT /api/indicators { key, enabled, params } → সেটিংস আপডেট
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_INDICATOR_CONFIG, type IndicatorKey } from '@/lib/types';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const VALID_KEYS: IndicatorKey[] = ['ema', 'bb', 'rsi', 'macd'];

/** প্রতিটি ইন্ডিকেটরের প্যারামিটার সীমা */
const PARAM_LIMITS: Record<IndicatorKey, Record<string, [number, number]>> = {
  ema: { 'periods.0': [2, 500], 'periods.1': [2, 500] },
  bb: { period: [2, 500], mult: [0.5, 10] },
  rsi: { period: [2, 200] },
  macd: { fast: [2, 200], slow: [3, 400], signal: [2, 200] },
};

/** params ভ্যালিড ও সীমার মধ্যে আছে কিনা যাচাই */
function validateParams(key: IndicatorKey, params: unknown): boolean {
  if (typeof params !== 'object' || params === null) return false;
  const p = params as Record<string, unknown>;

  switch (key) {
    case 'ema': {
      const periods = p.periods;
      if (!Array.isArray(periods) || periods.length !== 2) return false;
      return periods.every(
        (v) => Number.isFinite(v) && v >= PARAM_LIMITS.ema['periods.0'][0] && v <= PARAM_LIMITS.ema['periods.0'][1]
      );
    }
    case 'bb': {
      const { period, mult } = p as Record<string, unknown>;
      return (
        Number.isFinite(period) && Number(period) >= 2 && Number(period) <= 500 &&
        Number.isFinite(mult) && Number(mult) >= 0.5 && Number(mult) <= 10
      );
    }
    case 'rsi': {
      const { period } = p as Record<string, unknown>;
      return Number.isFinite(period) && Number(period) >= 2 && Number(period) <= 200;
    }
    case 'macd': {
      const { fast, slow, signal } = p as Record<string, unknown>;
      return (
        Number.isFinite(fast) && Number(fast) >= 2 &&
        Number.isFinite(slow) && Number(slow) > Number(fast) && Number(slow) <= 400 &&
        Number.isFinite(signal) && Number(signal) >= 2
      );
    }
  }
}

async function ensureSeeded() {
  const count = await db.indicatorConfig.count();
  if (count > 0) return;
  for (const cfg of Object.values(DEFAULT_INDICATOR_CONFIG)) {
    await db.indicatorConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: { key: cfg.key, enabled: cfg.enabled, params: JSON.stringify(cfg.params) },
    });
  }
}

export async function GET() {
  try {
    await ensureSeeded();
    const rows = await db.indicatorConfig.findMany();
    const map: Record<string, { key: string; enabled: boolean; params: unknown }> = {};
    for (const row of rows) {
      let params: unknown = {};
      try {
        params = JSON.parse(row.params);
      } catch {
        params = {};
      }
      map[row.key] = { key: row.key, enabled: row.enabled, params };
    }
    return NextResponse.json({ success: true, data: map });
  } catch (err) {
    console.error('[api/indicators GET] ত্রুটি:', err);
    return NextResponse.json(
      { success: false, error: 'ইন্ডিকেটর সেটিংস লোড করা যায়নি' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const rl = rateLimit(`indicators-w:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: 'অনেক বেশি অনুরোধ' }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => null);
    const key = String(body?.key ?? '') as IndicatorKey;
    if (!VALID_KEYS.includes(key)) {
      return NextResponse.json({ success: false, error: `অবৈধ ইন্ডিকেটর key: ${key}` }, { status: 400 });
    }
    const enabled = Boolean(body?.enabled);
    const params = body?.params;
    if (!validateParams(key, params)) {
      return NextResponse.json({ success: false, error: 'অবৈধ প্যারামিটার মান' }, { status: 400 });
    }

    const saved = await db.indicatorConfig.upsert({
      where: { key },
      update: { enabled, params: JSON.stringify(params) },
      create: { key, enabled, params: JSON.stringify(params) },
    });
    return NextResponse.json({ success: true, data: { key: saved.key, enabled: saved.enabled, params } });
  } catch (err) {
    console.error('[api/indicators PUT] ত্রুটি:', err);
    return NextResponse.json(
      { success: false, error: 'সেটিংস সংরক্ষণ করা যায়নি' },
      { status: 500 }
    );
  }
}
