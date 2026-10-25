/**
 * WatchlistPanel — ফলো করা সিম্বলের তালিকা + লাইভ মিনি-টিকার + যোগ/মুছুন।
 */

'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Ticker24h } from '@/lib/types';
import { DEFAULT_SYMBOLS, SYMBOL_LABELS } from '@/lib/types';
import { formatPercent, formatPrice } from '@/lib/format';

interface WatchlistPanelProps {
  symbols: string[];
  tickers: Record<string, Ticker24h>;
  activeSymbol: string;
  onSelect: (s: string) => void;
  onAdd: (s: string) => Promise<boolean>;
  onRemove: (s: string) => void;
  loading: boolean;
}

export default function WatchlistPanel({
  symbols,
  tickers,
  activeSymbol,
  onSelect,
  onAdd,
  onRemove,
  loading,
}: WatchlistPanelProps) {
  const [addValue, setAddValue] = useState('');
  const available = DEFAULT_SYMBOLS.filter((s) => !symbols.includes(s));

  const handleAdd = async () => {
    if (!addValue) return;
    const ok = await onAdd(addValue);
    if (ok) setAddValue('');
  };

  return (
    <section className="p-3" aria-label="ওয়াচলিস্ট">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">ওয়াচলিস্ট</h3>
        <span className="text-[11px] text-neutral-600">{symbols.length} সিম্বল</span>
      </div>

      {/* যোগ করার নিয়ন্ত্রণ */}
      <div className="mb-2 flex gap-1.5">
        <Select value={addValue} onValueChange={setAddValue}>
          <SelectTrigger
            className="h-8 flex-1 border-[#2A323B] bg-[#161B22] text-xs text-neutral-200"
            aria-label="নতুন সিম্বল নির্বাচন"
          >
            <SelectValue placeholder="সিম্বল নির্বাচন করুন" />
          </SelectTrigger>
          <SelectContent className="border-[#2A323B] bg-[#161B22] text-neutral-100">
            {available.map((s) => (
              <SelectItem key={s} value={s} className="focus:bg-[#222A34]">
                {s.replace('USDT', '/USDT')} <span className="ml-1 text-xs text-neutral-500">{SYMBOL_LABELS[s]}</span>
              </SelectItem>
            ))}
            {available.length === 0 && (
              <div className="px-3 py-2 text-xs text-neutral-500">সব সিম্বল যোগ করা আছে</div>
            )}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!addValue}
          className="h-8 bg-[#FCD535] px-2 text-black hover:brightness-110"
          aria-label="সিম্বল যোগ করুন"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="max-h-52">
        <ul className="space-y-0.5" role="listbox" aria-label="ওয়াচলিস্ট সিম্বল তালিকা">
          {loading && symbols.length === 0 && (
            <li className="py-3 text-center text-xs text-neutral-600">লোড হচ্ছে…</li>
          )}
          {symbols.map((s) => {
            const t = tickers[s];
            const up = (t?.changePercent ?? 0) >= 0;
            const active = s === activeSymbol;
            return (
              <li key={s}>
                <div
                  role="option"
                  aria-selected={active}
                  tabIndex={0}
                  onClick={() => onSelect(s)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelect(s);
                  }}
                  className={`group flex cursor-pointer items-center justify-between rounded px-2 py-1.5 transition-colors ${
                    active ? 'bg-[#222A34]' : 'hover:bg-[#181E26]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold ${active ? 'text-[#FCD535]' : 'text-neutral-200'}`}>
                      {s.replace('USDT', '/USDT')}
                    </div>
                    <div className="truncate text-[10px] text-neutral-600">{SYMBOL_LABELS[s] ?? s}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="text-right">
                      <div className={`font-mono text-xs tabular-nums ${up ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                        {t ? formatPrice(t.last) : '—'}
                      </div>
                      <div className={`font-mono text-[10px] tabular-nums ${up ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                        {t ? formatPercent(t.changePercent) : '—'}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(s);
                      }}
                      className="rounded p-1 text-neutral-600 opacity-0 transition group-hover:opacity-100 hover:bg-[#F6465D]/15 hover:text-[#F6465D] focus:opacity-100"
                      aria-label={`${s} ওয়াচলিস্ট থেকে মুছুন`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </section>
  );
}
