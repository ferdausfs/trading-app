/**
 * TradingDashboard — মূল অ্যাপ লেআউট।
 *
 * ডেস্কটপ: চার্ট (বাম) + সাইডবার (ওয়াচলিস্ট, ইন্ডিকেটর, পরিসংখ্যান)
 * মোবাইল: চার্ট উপরে, তারপর ট্যাবে সাইডবার কন্টেন্ট
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PriceChart from './PriceChart';
import TopBar from './TopBar';
import WatchlistPanel from './WatchlistPanel';
import IndicatorPanel from './IndicatorPanel';
import MarketStats from './MarketStats';
import { useMarketData } from '@/hooks/use-market-data';
import { useIndicatorSettings } from '@/hooks/use-indicator-settings';
import { useWatchlist } from '@/hooks/use-watchlist';
import { getMarketFeed } from '@/lib/market-feed';
import { DEFAULT_SYMBOLS, type Timeframe, type Ticker24h } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

export default function TradingDashboard() {
  const [symbol, setSymbol] = useState<string>('BTCUSDT');
  const [interval, setIntervalTf] = useState<Timeframe>('1m');
  // টিকার স্টেট সিম্বল-স্ট্যাম্প সহ রাখা হয় — সিম্বল বদলালে পুরনো দাম দেখায় না
  const [tickerState, setTickerState] = useState<{ sym: string; data: Ticker24h } | null>(null);
  const ticker = tickerState?.sym === symbol ? tickerState.data : null;

  const { candles, historyLoading, historyError, status, reload } = useMarketData(symbol, interval);
  const { configs, update } = useIndicatorSettings();
  const watchlist = useWatchlist();

  const symbolsForSelect = useMemo(() => {
    // ওয়াচলিস্ট + ডিফল্ট সব সিম্বল (ডুপ্লিকেট বাদ)
    const set = new Set<string>([...watchlist.symbols, ...DEFAULT_SYMBOLS]);
    return Array.from(set);
  }, [watchlist.symbols]);

  // মেইন সিম্বলের লাইভ টিকার (ফিড থেকে)
  useEffect(() => {
    const feed = getMarketFeed();
    const off = feed.on('ticker', (t) => {
      if (t.symbol === symbol) setTickerState({ sym: t.symbol, data: t });
    });
    return off;
  }, [symbol]);

  // সিম্বল বদলালে REST থেকে প্রাথমিক টিকার (ফিডের টিকার আসার আগে)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/market/ticker?symbols=${symbol}`)
      .then((r) => r.json())
      .then((res: { success: boolean; data?: Ticker24h[] }) => {
        if (!cancelled && res.success && res.data?.[0]) {
          setTickerState({ sym: symbol, data: res.data[0] });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // ফিড ত্রুটি টোস্ট
  useEffect(() => {
    const feed = getMarketFeed();
    const off = feed.on('error', (e) => {
      toast({ title: 'মার্কেট ফিড ত্রুটি', description: e.message, variant: 'destructive' });
    });
    return off;
  }, []);

  const handleAdd = async (s: string) => {
    const ok = await watchlist.add(s);
    if (ok) toast({ title: `${s} ওয়াচলিস্টে যোগ হয়েছে` });
    else if (watchlist.error) toast({ title: watchlist.error, variant: 'destructive' });
    return ok;
  };

  const handleRemove = (s: string) => {
    if (s === symbol) {
      toast({ title: 'সক্রিয় সিম্বল মুছতে পারবেন না', description: 'আগে অন্য সিম্বলে যান', variant: 'destructive' });
      return;
    }
    watchlist.remove(s);
  };

  const selectSymbol = (s: string) => {
    setSymbol(s);
  };

  const sidebarContent = (
    <>
      <WatchlistPanel
        symbols={watchlist.symbols}
        tickers={watchlist.tickers}
        activeSymbol={symbol}
        onSelect={selectSymbol}
        onAdd={handleAdd}
        onRemove={handleRemove}
        loading={watchlist.loading}
      />
      <div className="border-t border-[#1F242B]" />
      <IndicatorPanel configs={configs} update={update} />
      <div className="border-t border-[#1F242B]" />
      <MarketStats ticker={ticker} />
    </>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0B0D10] text-neutral-100">
      <TopBar
        symbol={symbol}
        onSymbolChange={selectSymbol}
        interval={interval}
        onIntervalChange={setIntervalTf}
        ticker={ticker}
        status={status}
        symbols={symbolsForSelect}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* চার্ট */}
        <main className="relative min-h-[240px] flex-1 overflow-hidden lg:min-h-0" aria-label="মূল চার্ট">
          <PriceChart
            candles={candles}
            configs={configs}
            loading={historyLoading}
            error={historyError}
            onRetry={reload}
            symbol={symbol}
            interval={interval}
          />
        </main>

        {/* ডেস্কটপ সাইডবার */}
        <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-[#1F242B] bg-[#0E1116] lg:flex">
          {sidebarContent}
        </aside>
      </div>

      {/* মোবাইল ট্যাব — নির্দিষ্ট উচ্চতা, shrink নিষেধ (চার্টের সাথে ওভারল্যাপ এড়াতে) */}
      <div className="h-[36vh] shrink-0 border-t border-[#1F242B] bg-[#0E1116] lg:hidden">
        <Tabs defaultValue="watchlist" className="flex h-full flex-col">
          <TabsList className="mx-3 mt-2 grid w-auto grid-cols-3 bg-[#161B22]">
            <TabsTrigger value="watchlist" className="text-xs data-[state=active]:text-[#FCD535]">ওয়াচলিস্ট</TabsTrigger>
            <TabsTrigger value="indicators" className="text-xs data-[state=active]:text-[#FCD535]">ইন্ডিকেটর</TabsTrigger>
            <TabsTrigger value="stats" className="text-xs data-[state=active]:text-[#FCD535]">পরিসংখ্যান</TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <TabsContent value="watchlist" className="mt-0">
              <WatchlistPanel
                symbols={watchlist.symbols}
                tickers={watchlist.tickers}
                activeSymbol={symbol}
                onSelect={selectSymbol}
                onAdd={handleAdd}
                onRemove={handleRemove}
                loading={watchlist.loading}
              />
            </TabsContent>
            <TabsContent value="indicators" className="mt-0">
              <IndicatorPanel configs={configs} update={update} />
            </TabsContent>
            <TabsContent value="stats" className="mt-0">
              <MarketStats ticker={ticker} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
