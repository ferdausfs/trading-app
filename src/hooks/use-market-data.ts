/**
 * useMarketData — ঐতিহাসিক ক্যান্ডেল লোড + রিয়েল-টাইম সাবস্ক্রিপশন।
 *
 * পারফরম্যান্স:
 * - প্রতিটি WebSocket টিক সরাসরি setState ট্রিগার করে না; ২৫০ms ব্যাচে ফ্লাশ হয়
 *   (Throttling — স্পেসিফিকেশনের পারফরম্যান্স কৌশল #৫)।
 * - loading/error স্টেট ডেরাইভ করা হয় (symbol:interval key দিয়ে),
 *   ফলে effect বডিতে synchronous setState লাগে না (React 19 নিয়ম)।
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getMarketFeed, type KlineEvent } from '@/lib/market-feed';
import type { Candle, FeedStatus } from '@/lib/types';

const FLUSH_INTERVAL_MS = 250;

export interface MarketDataState {
  candles: Candle[];
  historyLoading: boolean;
  historyError: string | null;
  status: FeedStatus;
  lastTickAt: number;
  reload: () => void;
}

export function useMarketData(symbol: string, interval: string): MarketDataState {
  const key = `${symbol}:${interval}`;

  // { key, data } আকারে রাখা হয় — key না মিললে পুরনো সিম্বলের ডেটা দেখানো হয় না
  const [candleState, setCandleState] = useState<{ key: string; data: Candle[] }>({ key: '', data: [] });
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{ key: string; message: string } | null>(null);
  const [status, setStatus] = useState<FeedStatus>('connecting');
  const [lastTickAt, setLastTickAt] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const candlesRef = useRef<Candle[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(key);

  // ref আপডেট শুধু effect এ (রেন্ডারে ref লেখা নিষেধ)
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  const candles = candleState.key === key ? candleState.data : [];
  const historyLoading = loadedKey !== key;
  const historyError = errorState?.key === key ? errorState.message : null;

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // ---- ঐতিহাসিক ডেটা লোড ----
  useEffect(() => {
    let cancelled = false;
    candlesRef.current = []; // ref mutation — পুরনো সিম্বলের লাইভ টিক বাদ

    fetch(`/api/market/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=500`)
      .then((r) => r.json())
      .then((res: { success: boolean; data?: Candle[]; error?: string }) => {
        if (cancelled) return;
        setLoadedKey(key);
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          candlesRef.current = res.data;
          setCandleState({ key, data: res.data });
          setErrorState(null);
        } else {
          setCandleState({ key, data: [] });
          setErrorState({ key, message: res.error ?? 'ডেটা লোড করা যায়নি' });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLoadedKey(key);
        setErrorState({ key, message: 'নেটওয়ার্ক ত্রুটি — ইন্টারনেট সংযোগ পরীক্ষা করুন' });
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, interval, key, reloadKey]);

  // ---- রিয়েল-টাইম সাবস্ক্রিপশন ----
  useEffect(() => {
    const feed = getMarketFeed();
    feed.subscribe(symbol, interval);

    const scheduleFlush = () => {
      if (flushTimerRef.current) return;
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        setCandleState({ key: keyRef.current, data: [...candlesRef.current] });
      }, FLUSH_INTERVAL_MS);
    };

    const onKline = (e: KlineEvent) => {
      if (e.symbol !== symbol || e.interval !== interval) return;
      const k = e.kline;
      const arr = candlesRef.current;
      const last = arr[arr.length - 1];
      if (!last || k.time > last.time) {
        arr.push(k);
        if (arr.length > 1500) arr.splice(0, arr.length - 1500); // মেমরি সীমা
      } else if (k.time === last.time) {
        arr[arr.length - 1] = k;
      } else {
        return; // পুরনো/বাউন্ড-আউট টিক
      }
      setLastTickAt(Date.now());
      scheduleFlush();
    };

    const offKline = feed.on('kline', onKline);
    const offStatus = feed.on('status', setStatus);

    return () => {
      offKline();
      offStatus();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [symbol, interval]);

  return { candles, historyLoading, historyError, status, lastTickAt, reload };
}
