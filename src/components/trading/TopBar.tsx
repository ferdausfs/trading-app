/**
 * TopBar — সিম্বল নির্বাচন, টাইমফ্রেম, লাইভ প্রাইস ও কানেকশন স্টেটাস।
 */

'use client';

import { Activity } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { FeedStatus, Ticker24h, Timeframe, TIMEFRAMES, TIMEFRAME_LABELS } from '@/lib/types';
import { TIMEFRAMES as TF_LIST, TIMEFRAME_LABELS as TF_LABELS, SYMBOL_LABELS } from '@/lib/types';
import { formatPercent, formatPrice } from '@/lib/format';

interface TopBarProps {
  symbol: string;
  onSymbolChange: (s: string) => void;
  interval: Timeframe;
  onIntervalChange: (t: Timeframe) => void;
  ticker: Ticker24h | null;
  status: FeedStatus;
  symbols: string[];
}

const STATUS_CONFIG: Record<FeedStatus, { label: string; dot: string; text: string }> = {
  live: { label: 'লাইভ', dot: 'bg-[#0ECB81]', text: 'text-[#0ECB81]' },
  connecting: { label: 'সংযুক্ত হচ্ছে', dot: 'bg-[#FCD535]', text: 'text-[#FCD535]' },
  offline: { label: 'অফলাইন', dot: 'bg-[#F6465D]', text: 'text-[#F6465D]' },
};

export default function TopBar({
  symbol,
  onSymbolChange,
  interval,
  onIntervalChange,
  ticker,
  status,
  symbols,
}: TopBarProps) {
  const st = STATUS_CONFIG[status];
  const changeUp = (ticker?.changePercent ?? 0) >= 0;
  const priceUp = ticker ? ticker.changePercent >= 0 : true;

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#1F242B] bg-[#0E1116] px-3 py-2 sm:px-4">
      {/* লোগো */}
      <div className="flex items-center gap-2 pr-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#FCD535]">
          <Activity className="h-4 w-4 text-black" strokeWidth={2.5} />
        </div>
        <span className="hidden text-sm font-bold tracking-tight text-neutral-100 sm:block">
          TradeLite
        </span>
      </div>

      {/* সিম্বল নির্বাচক */}
      <Select value={symbol} onValueChange={onSymbolChange}>
        <SelectTrigger
          className="h-9 w-[168px] border-[#2A323B] bg-[#161B22] text-left font-semibold text-neutral-100"
          aria-label="ট্রেডিং সিম্বল নির্বাচন"
        >
          <SelectValue placeholder="সিম্বল" />
        </SelectTrigger>
        <SelectContent className="max-h-72 border-[#2A323B] bg-[#161B22] text-neutral-100">
          {symbols.map((s) => (
            <SelectItem key={s} value={s} className="focus:bg-[#222A34]">
              <span className="font-semibold">{s.replace('USDT', '/USDT')}</span>
              <span className="ml-2 text-xs text-neutral-500">{SYMBOL_LABELS[s] ?? ''}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* টাইমফ্রেম */}
      <ToggleGroup
        type="single"
        value={interval}
        onValueChange={(v) => {
          if (v) onIntervalChange(v as Timeframe);
        }}
        className="gap-0.5 rounded-md border border-[#2A323B] bg-[#161B22] p-0.5"
        aria-label="টাইমফ্রেম নির্বাচন"
      >
        {TF_LIST.map((tf) => (
          <ToggleGroupItem
            key={tf}
            value={tf}
            title={TF_LABELS[tf]}
            className="h-7 min-w-9 rounded px-1.5 text-xs font-medium text-neutral-400 data-[state=on]:bg-[#2A323B] data-[state=on]:text-[#FCD535]"
          >
            {tf.toUpperCase()}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* লাইভ প্রাইস */}
      <div className="ml-auto flex items-center gap-3 sm:gap-4">
        <div className="text-right">
          <div
            className={`font-mono text-base font-bold tabular-nums leading-5 sm:text-lg ${
              priceUp ? 'text-[#0ECB81]' : 'text-[#F6465D]'
            }`}
          >
            {ticker ? formatPrice(ticker.last) : '—'}
          </div>
          <div className={`font-mono text-xs tabular-nums ${changeUp ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
            {ticker ? formatPercent(ticker.changePercent) : '—'}
          </div>
        </div>

        {/* কানেকশন স্টেটাস */}
        <div
          className="flex items-center gap-1.5 rounded-full border border-[#2A323B] bg-[#161B22] px-2.5 py-1"
          role="status"
          aria-live="polite"
        >
          <span className={`relative flex h-2 w-2`}>
            {status === 'live' && (
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${st.dot} opacity-60`} />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${st.dot}`} />
          </span>
          <span className={`text-xs font-medium ${st.text}`}>{st.label}</span>
        </div>
      </div>
    </header>
  );
}
