/**
 * IndicatorPanel — চারটি ইন্ডিকেটরের টগল ও প্যারামিটার সেটিংস।
 * পরিবর্তন অপটিমিস্টিকভাবে UI তে প্রয়োগ হয় এবং ডিবাউন্স করে DB তে সেভ হয়।
 */

'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { INDICATOR_LABELS, type IndicatorConfigMap, type IndicatorKey } from '@/lib/types';

interface IndicatorPanelProps {
  configs: IndicatorConfigMap | null;
  update: (key: IndicatorKey, patch: { enabled?: boolean; params?: Record<string, unknown> }) => void;
}

const INDICATOR_COLORS: Record<IndicatorKey, string> = {
  ema: '#FCD535',
  bb: '#2DD4BF',
  rsi: '#FCD535',
  macd: '#2DD4BF',
};

/** ছোট সংখ্যা ইনপুট */
function NumField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] text-neutral-500">{label}</Label>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className="h-7 w-full border-[#2A323B] bg-[#161B22] px-2 font-mono text-xs text-neutral-100"
      />
    </div>
  );
}

export default function IndicatorPanel({ configs, update }: IndicatorPanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!configs) {
    return (
      <section className="p-3" aria-label="ইন্ডিকেটর সেটিংস">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">ইন্ডিকেটর</h3>
        <p className="py-2 text-center text-xs text-neutral-600">লোড হচ্ছে…</p>
      </section>
    );
  }

  const toggleExpand = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  return (
    <section className="p-3" aria-label="ইন্ডিকেটর সেটিংস">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">ইন্ডিকেটর</h3>

      <ul className="space-y-1">
        {(Object.keys(configs) as IndicatorKey[]).map((key) => {
          const cfg = configs[key];
          return (
            <li key={key} className="rounded-md border border-transparent bg-[#12161C] px-2.5 py-2 transition hover:border-[#2A323B]">
              <div className="flex items-center justify-between gap-2">
                <button
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => toggleExpand(key)}
                  aria-expanded={!!expanded[key]}
                  aria-label={`${INDICATOR_LABELS[key]} সেটিংস`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: INDICATOR_COLORS[key] }} />
                  <span className="truncate text-xs font-medium text-neutral-200">
                    {INDICATOR_LABELS[key].split(' (')[0]}
                  </span>
                </button>
                <Switch
                  checked={cfg.enabled}
                  onCheckedChange={(v) => update(key, { enabled: v })}
                  aria-label={`${INDICATOR_LABELS[key]} চালু/বন্ধ`}
                  className="data-[state=checked]:bg-[#FCD535]"
                />
              </div>

              {/* প্যারামিটার — সক্রিয় ও খোলা থাকলে */}
              {cfg.enabled && expanded[key] && (
                <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-[#1F242B] pt-2">
                  {key === 'ema' && (
                    <>
                      <NumField
                        label="দ্রুত EMA"
                        value={cfg.params.periods[0]}
                        min={2}
                        max={500}
                        onChange={(v) => update('ema', { params: { periods: [v, cfg.params.periods[1]] } })}
                      />
                      <NumField
                        label="ধীর EMA"
                        value={cfg.params.periods[1]}
                        min={2}
                        max={500}
                        onChange={(v) => update('ema', { params: { periods: [cfg.params.periods[0], v] } })}
                      />
                    </>
                  )}
                  {key === 'rsi' && (
                    <NumField
                      label="পিরিয়ড"
                      value={cfg.params.period}
                      min={2}
                      max={200}
                      onChange={(v) => update('rsi', { params: { period: v } })}
                    />
                  )}
                  {key === 'macd' && (
                    <>
                      <NumField label="Fast" value={cfg.params.fast} min={2} max={200} onChange={(v) => update('macd', { params: { fast: v } })} />
                      <NumField label="Slow" value={cfg.params.slow} min={3} max={400} onChange={(v) => update('macd', { params: { slow: v } })} />
                      <NumField label="Signal" value={cfg.params.signal} min={2} max={200} onChange={(v) => update('macd', { params: { signal: v } })} />
                    </>
                  )}
                  {key === 'bb' && (
                    <>
                      <NumField label="পিরিয়ড" value={cfg.params.period} min={2} max={500} onChange={(v) => update('bb', { params: { period: v } })} />
                      <NumField label="StdDev ×" value={cfg.params.mult} min={0.5} max={10} onChange={(v) => update('bb', { params: { mult: v } })} />
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-[10px] leading-4 text-neutral-600">
        সেটিংস স্বয়ংক্রিয়ভাবে ডাটাবেসে সংরক্ষিত হয়। প্যারামিটার দেখতে নামে ক্লিক করুন।
      </p>
    </section>
  );
}
