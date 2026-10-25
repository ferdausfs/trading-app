/**
 * useWatchlist — ওয়াচলিস্ট সিম্বল + লাইভ মিনি-টিকার (৫ সেকেন্ড পোলিং)।
 * টিকার ডেটা REST ক্যাশ API থেকে আসে — একাধিক সিম্বল এক রিকোয়েস্টে।
 * loading স্টেট ডেরাইভড (প্রথম লোড শেষ হলেই false) — effect এ sync setState নেই।
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Ticker24h } from '@/lib/types';

const POLL_INTERVAL_MS = 5000;

export interface WatchlistState {
  symbols: string[];
  tickers: Record<string, Ticker24h>;
  loading: boolean;
  error: string | null;
  add: (symbol: string) => Promise<boolean>;
  remove: (symbol: string) => Promise<void>;
  refresh: () => void;
}

export function useWatchlist(): WatchlistState {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [tickers, setTickers] = useState<Record<string, Ticker24h>>({});
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // ওয়াচলিস্ট লোড
  useEffect(() => {
    let cancelled = false;
    fetch('/api/watchlist')
      .then((r) => r.json())
      .then((res: { success: boolean; data?: { symbol: string }[] }) => {
        if (cancelled) return;
        setInitialized(true);
        if (res.success && Array.isArray(res.data)) {
          setSymbols(res.data.map((d) => d.symbol));
        } else {
          setError('ওয়াচলিস্ট লোড করা যায়নি');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInitialized(true);
          setError('ওয়াচলিস্ট লোড করা যায়নি');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // টিকার পোলিং
  useEffect(() => {
    if (symbols.length === 0) return;
    let cancelled = false;

    const poll = () => {
      fetch(`/api/market/ticker?symbols=${symbols.join(',')}`)
        .then((r) => r.json())
        .then((res: { success: boolean; data?: Ticker24h[] }) => {
          if (cancelled || !res.success || !Array.isArray(res.data)) return;
          const next: Record<string, Ticker24h> = {};
          for (const t of res.data) next[t.symbol] = t;
          setTickers((prev) => ({ ...prev, ...next }));
        })
        .catch(() => {});
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [symbols]);

  const add = useCallback(
    async (symbol: string): Promise<boolean> => {
      setError(null);
      try {
        const res = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol }),
        });
        const json = await res.json();
        if (!json.success) {
          setError(json.error ?? 'যোগ করা যায়নি');
          return false;
        }
        refresh();
        return true;
      } catch {
        setError('নেটওয়ার্ক ত্রুটি');
        return false;
      }
    },
    [refresh]
  );

  const remove = useCallback(
    async (symbol: string): Promise<void> => {
      try {
        await fetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, { method: 'DELETE' });
        refresh();
      } catch {
        setError('মুছা যায়নি');
      }
    },
    [refresh]
  );

  return { symbols, tickers, loading: !initialized, error, add, remove, refresh };
}
