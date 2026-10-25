/**
 * MarketStats — সক্রিয় সিম্বলের ২৪ ঘণ্টার পরিসংখ্যান।
 */

'use client';

import { BarChart3 } from 'lucide-react';
import type { Ticker24h } from '@/lib/types';
import { formatCompact, formatPercent, formatPrice } from '@/lib/format';

interface MarketStatsProps {
  ticker: Ticker24h | null;
}

export default function MarketStats({ ticker }: MarketStatsProps) {
  if (!ticker) {
    return (
      <section className="p-3" aria-label="মার্কেট পরিসংখ্যান">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">মার্কেট পরিসংখ্যান (২৪ঘ)</h3>
        <p className="py-2 text-center text-xs text-neutral-600">ডেটা লোড হচ্ছে…</p>
      </section>
    );
  }

  const up = ticker.changePercent >= 0;

  const rows: { label: string; value: string; className?: string }[] = [
    { label: '২৪ঘ উচ্চ', value: formatPrice(ticker.high) },
    { label: '২৪ঘ নিচ', value: formatPrice(ticker.low) },
    { label: '২৪ঘ ওপেন', value: formatPrice(ticker.open) },
    { label: '২৪ঘ পরিবর্তন', value: formatPercent(ticker.changePercent), className: up ? 'text-[#0ECB81]' : 'text-[#F6465D]' },
    { label: 'কোট ভলিউম (USDT)', value: formatCompact(ticker.quoteVolume) },
  ];

  return (
    <section className="p-3" aria-label="মার্কেট পরিসংখ্যান">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        <BarChart3 className="h-3.5 w-3.5" /> মার্কেট পরিসংখ্যান (২৪ঘ)
      </h3>
      <dl className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <dt className="text-xs text-neutral-500">{r.label}</dt>
            <dd className={`font-mono text-xs tabular-nums ${r.className ?? 'text-neutral-200'}`}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
