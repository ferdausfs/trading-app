/**
 * ChartScreen (মোবাইল) — চার্ট + লাইভ দাম + ইন্ডিকেটর প্যানেল।
 * ওয়েবের useMarketData হুকের অনুরূপ লজিক: REST হিস্টরি + Socket.IO লাইভ টিক।
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import CandleChart from '../components/CandleChart';
import IndicatorPanel from '../components/IndicatorPanel';
import { connectAndSubscribe, unsubscribe, onKline, onTicker, onStatus, fetchKlines, fetchTicker } from '../lib/api';
import { COLORS, DEFAULT_SYMBOLS, SYMBOL_LABELS, TIMEFRAMES } from '../config';

function fmt(n) {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const dec = abs >= 1000 ? 1 : abs >= 1 ? 2 : 6;
  return n.toLocaleString('en-US', { minimumFractionDigits: dec > 2 ? 2 : dec, maximumFractionDigits: dec });
}

const DEFAULT_CONFIGS = {
  ema: { key: 'ema', enabled: true, params: { periods: [20, 50] } },
  bb: { key: 'bb', enabled: false, params: { period: 20, mult: 2 } },
  rsi: { key: 'rsi', enabled: true, params: { period: 14 } },
  macd: { key: 'macd', enabled: true, params: { fast: 12, slow: 26, signal: 9 } },
};

export default function ChartScreen() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('1m');
  const [dataState, setDataState] = useState({ key: '', data: [] });
  const [loadedKey, setLoadedKey] = useState(null);
  const [ticker, setTicker] = useState(null);
  const [configs, setConfigs] = useState(DEFAULT_CONFIGS);
  const [status, setStatus] = useState('connecting');
  const candlesRef = useRef([]);
  const [reloadKey, setReloadKey] = useState(0);

  const key = `${symbol}:${interval}`;
  // ডেরাইভড স্টেট — key না মিললে পুরনো সিম্বলের ডেটা দেখানো হয় না
  const candles = dataState.key === key ? dataState.data : [];
  const loading = loadedKey !== key;

  // হিস্টরি লোড
  useEffect(() => {
    let cancelled = false;
    candlesRef.current = []; // পুরনো সিম্বলের লাইভ টিক বাদ (ref mutation)
    fetchKlines(symbol, interval, 300)
      .then((data) => {
        if (cancelled) return;
        candlesRef.current = data;
        setDataState({ key, data });
        setLoadedKey(key);
      })
      .catch(() => {
        if (!cancelled) {
          setDataState({ key, data: [] });
          setLoadedKey(key);
        }
      });
    fetchTicker(symbol).then((t) => !cancelled && setTicker(t)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbol, interval, key, reloadKey]);

  // লাইভ সাবস্ক্রিপশন
  useEffect(() => {
    connectAndSubscribe(symbol, interval);

    const offK = onKline((e) => {
      if (e.symbol !== symbol || e.interval !== interval) return;
      const arr = candlesRef.current;
      const last = arr[arr.length - 1];
      const k = e.kline;
      if (!last || k.time > last.time) arr.push(k);
      else if (k.time === last.time) arr[arr.length - 1] = k;
      else return;
      setCandles([...arr]);
    });
    const offT = onTicker((t) => {
      if (t.symbol === symbol) setTicker(t);
    });
    const offS = onStatus(setStatus);

    return () => {
      offK();
      offT();
      offS();
      unsubscribe(symbol, interval);
    };
  }, [symbol, interval]);

  const changeUp = (ticker?.changePercent ?? 0) >= 0;

  const handleConfigChange = useCallback((key, patch) => {
    setConfigs((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch, params: { ...prev[key].params, ...(patch.params || {}) } },
    }));
  }, []);

  const emaPeriods = useMemo(() => configs.ema.params.periods, [configs]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 24 }}>
      {/* সিম্বল স্ট্রিপ */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.symbolStrip}>
        {DEFAULT_SYMBOLS.map((s) => (
          <TouchableOpacity key={s} onPress={() => setSymbol(s)}>
            <View style={[styles.symbolChip, s === symbol && styles.symbolChipActive]}>
              <Text style={[styles.symbolText, s === symbol && { color: COLORS.accent }]}>
                {s.replace('USDT', '')}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* দাম হেডার */}
      <View style={styles.priceRow}>
        <View>
          <Text style={styles.symbolTitle}>{symbol.replace('USDT', '/USDT')}</Text>
          <Text style={styles.symbolSub}>{SYMBOL_LABELS[symbol] ?? ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.price, { color: changeUp ? COLORS.up : COLORS.down }]}>
            {ticker ? fmt(ticker.last) : '—'}
          </Text>
          <Text style={[styles.change, { color: changeUp ? COLORS.up : COLORS.down }]}>
            {ticker ? `${ticker.changePercent >= 0 ? '+' : ''}${ticker.changePercent.toFixed(2)}%` : '—'}
            {status === 'live' ? '  ● লাইভ' : '  ○ সংযুক্ত হচ্ছে'}
          </Text>
        </View>
      </View>

      {/* টাইমফ্রেম */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {TIMEFRAMES.map((tf) => (
          <TouchableOpacity key={tf} onPress={() => setInterval(tf)}>
            <View style={[styles.tfChip, tf === interval && styles.tfChipActive]}>
              <Text style={[styles.tfText, tf === interval && { color: COLORS.accent }]}>{tf.toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* চার্ট */}
      <View style={styles.chartBox}>
        {loading && candles.length === 0 ? (
          <View style={{ height: 320, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg }}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        ) : (
          <CandleChart candles={candles} emaPeriods={emaPeriods} />
        )}
      </View>

      {/* ইন্ডিকেটর */}
      <IndicatorPanel configs={configs} onChange={handleConfigChange} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  symbolStrip: { paddingHorizontal: 8, paddingTop: 8 },
  symbolChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: COLORS.panel, marginRight: 6, borderWidth: 1, borderColor: COLORS.border,
  },
  symbolChipActive: { borderColor: COLORS.accent },
  symbolText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  symbolTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  symbolSub: { color: COLORS.muted, fontSize: 12 },
  price: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  change: { fontSize: 12, fontVariant: ['tabular-nums'] },
  tfChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 7,
    backgroundColor: COLORS.panel, marginLeft: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  tfChipActive: { borderColor: COLORS.accent },
  tfText: { color: COLORS.muted, fontSize: 11, fontWeight: '600' },
  chartBox: { marginTop: 8 },
});
