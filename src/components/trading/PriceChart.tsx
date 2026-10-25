/**
 * PriceChart — TradingView Lightweight Charts v5 ভিত্তিক চার্ট।
 *
 * পেইন স্ট্রাকচার:
 *   পেইন ০: ক্যান্ডেলস্টিক + ভলিউম (overlay) + EMA + Bollinger Bands
 *   পেইন ১: RSI (সক্রিয় থাকলে)
 *   পেইন ২: MACD (সক্রিয় থাকলে)
 *
 * পারফরম্যান্স:
 * - নতুন বার আসা পর্যন্ত incremental `update()` ব্যবহার হয়, পুরো `setData()`
 *   শুধু নতুন বার/প্যারামিটার পরিবর্তনে চলে (স্পেসিফিকেশনের কৌশল #১)।
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { bollinger, ema, macd, rsi, toLinePoints, closes } from '@/lib/indicators';
import { DEFAULT_INDICATOR_CONFIG, type Candle, type IndicatorConfigMap } from '@/lib/types';
import { formatCompact, formatPrice } from '@/lib/format';

interface PriceChartProps {
  candles: Candle[];
  configs: IndicatorConfigMap | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  symbol: string;
  interval: string;
}

const COLORS = {
  bg: '#0B0D10',
  grid: '#141920',
  border: '#1F242B',
  text: '#8A94A0',
  up: '#0ECB81',
  down: '#F6465D',
  ema1: '#FCD535',
  ema2: '#C77DFF',
  bb: '#2DD4BF',
  macdLine: '#2DD4BF',
  macdSignal: '#FCD535',
};

interface LegendState {
  time: number;
  open: number; high: number; low: number; close: number; volume: number;
  ema1: number | null; ema2: number | null;
  bbU: number | null; bbM: number | null; bbL: number | null;
  rsi: number | null;
  macd: number | null; macdSig: number | null; macdHist: number | null;
}

interface SeriesRefs {
  candle: ISeriesApi<'Candlestick'>;
  volume: ISeriesApi<'Histogram'>;
  ema1: ISeriesApi<'Line'>;
  ema2: ISeriesApi<'Line'>;
  bbU: ISeriesApi<'Line'>;
  bbM: ISeriesApi<'Line'>;
  bbL: ISeriesApi<'Line'>;
  rsi: ISeriesApi<'Line'> | null;
  macdLine: ISeriesApi<'Line'> | null;
  macdSig: ISeriesApi<'Line'> | null;
  macdHist: ISeriesApi<'Histogram'> | null;
}

function lastValue(series: (number | null)[]): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) return series[i];
  }
  return null;
}

function mapFromPoints(pts: { time: number; value: number }[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const p of pts) m.set(p.time, p.value);
  return m;
}

export default function PriceChart({ candles, configs, loading, error, onRetry, symbol, interval }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<SeriesRefs | null>(null);
  const candleByTimeRef = useRef<Map<number, Candle>>(new Map());
  const legendMapsRef = useRef<{
    ema1: Map<number, number>; ema2: Map<number, number>;
    bbU: Map<number, number>; bbM: Map<number, number>; bbL: Map<number, number>;
    rsi: Map<number, number>;
    macd: Map<number, number>; macdSig: Map<number, number>; macdHist: Map<number, number>;
  }>({
    ema1: new Map(), ema2: new Map(), bbU: new Map(), bbM: new Map(), bbL: new Map(),
    rsi: new Map(), macd: new Map(), macdSig: new Map(), macdHist: new Map(),
  });
  const metaRef = useRef<{ symbol: string; interval: string; len: number; first: number; paramsKey: string }>({
    symbol: '', interval: '', len: 0, first: 0, paramsKey: '',
  });
  const [legend, setLegend] = useState<LegendState | null>(null);

  const cfg = configs ?? DEFAULT_INDICATOR_CONFIG;
  // Oscillator পেইনের কাঠামো বদলালে চার্ট পুনঃনির্মাণ হয় (বিরল ইভেন্ট)
  const chartKey = `${cfg.rsi.enabled ? 1 : 0}${cfg.macd.enabled ? 1 : 0}`;

  // ---------- চার্ট তৈরি / পুনঃনির্মাণ ----------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: COLORS.bg },
        textColor: COLORS.text,
        fontSize: 11,
        fontFamily: "'Inter', 'Noto Sans Bengali', 'Segoe UI', system-ui, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: COLORS.grid },
        horzLines: { color: COLORS.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#4A545F', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#2A323B' },
        horzLine: { color: '#4A545F', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#2A323B' },
      },
      rightPriceScale: { borderColor: COLORS.border },
      timeScale: { borderColor: COLORS.border, timeVisible: true, secondsVisible: false, rightOffset: 4 },
      panes: {
        separatorColor: COLORS.border,
        separatorHoverColor: 'rgba(252, 213, 53, 0.15)',
        enableResize: true,
      },
    });
    chartRef.current = chart;

    // পেইন ০: ক্যান্ডেল + ভলিউম + ওভারলে ইন্ডিকেটর
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.up,
      downColor: COLORS.down,
      borderVisible: false,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    const lineBase = {
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    } as const;

    const ema1 = chart.addSeries(LineSeries, { ...lineBase, color: COLORS.ema1, lineWidth: 2 });
    const ema2 = chart.addSeries(LineSeries, { ...lineBase, color: COLORS.ema2, lineWidth: 2 });
    const bbU = chart.addSeries(LineSeries, { ...lineBase, color: COLORS.bb, lineWidth: 1 });
    const bbM = chart.addSeries(LineSeries, { ...lineBase, color: COLORS.bb, lineWidth: 1, lineStyle: LineStyle.Dashed });
    const bbL = chart.addSeries(LineSeries, { ...lineBase, color: COLORS.bb, lineWidth: 1 });

    // অসিলেটর পেইনগুলো
    let nextPane = 1;
    let rsiSeries: ISeriesApi<'Line'> | null = null;
    if (cfg.rsi.enabled) {
      rsiSeries = chart.addSeries(LineSeries, { ...lineBase, color: COLORS.ema1, lineWidth: 2 }, nextPane);
      rsiSeries.createPriceLine({ price: 70, color: '#5A6470', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
      rsiSeries.createPriceLine({ price: 30, color: '#5A6470', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
      nextPane += 1;
    }
    let macdLine: ISeriesApi<'Line'> | null = null;
    let macdSig: ISeriesApi<'Line'> | null = null;
    let macdHist: ISeriesApi<'Histogram'> | null = null;
    if (cfg.macd.enabled) {
      macdHist = chart.addSeries(HistogramSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
      }, nextPane);
      macdLine = chart.addSeries(LineSeries, { ...lineBase, color: COLORS.macdLine, lineWidth: 2 }, nextPane);
      macdSig = chart.addSeries(LineSeries, { ...lineBase, color: COLORS.macdSignal, lineWidth: 1 }, nextPane);
      nextPane += 1;
    }

    const panes = chart.panes();
    const hasOscillator = rsiSeries != null || macdLine != null;
    panes[0].setStretchFactor(hasOscillator ? 3.4 : 1);
    if (rsiSeries) panes[panes.length - (macdLine ? 2 : 1)].setStretchFactor(1);
    if (macdLine) panes[panes.length - 1].setStretchFactor(1);

    seriesRef.current = { candle: candleSeries, volume: volumeSeries, ema1, ema2, bbU, bbM, bbL, rsi: rsiSeries, macdLine, macdSig, macdHist };

    // ক্রসহেয়ার লিজেন্ড
    const unsubCross = chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        updateLegendFromLast();
        return;
      }
      const candle = candleByTimeRef.current.get(param.time as number);
      if (candle) buildLegend(candle);
    });

    function updateLegendFromLast() {
      const arr = candleByTimeRef.current;
      if (arr.size === 0) return;
      let lastC: Candle | null = null;
      // Map সর্বশেষ সন্নিবেশিত বারটিই ধরে — কিন্তু সময় অনুযায়ী সর্বোচ্চ দরকার
      for (const c of arr.values()) {
        if (!lastC || c.time >= lastC.time) lastC = c;
      }
      if (lastC) buildLegend(lastC);
    }

    function buildLegend(candle: Candle) {
      const maps = legendMapsRef.current;
      setLegend({
        time: candle.time,
        open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume,
        ema1: maps.ema1.get(candle.time) ?? null,
        ema2: maps.ema2.get(candle.time) ?? null,
        bbU: maps.bbU.get(candle.time) ?? null,
        bbM: maps.bbM.get(candle.time) ?? null,
        bbL: maps.bbL.get(candle.time) ?? null,
        rsi: maps.rsi.get(candle.time) ?? null,
        macd: maps.macd.get(candle.time) ?? null,
        macdSig: maps.macdSig.get(candle.time) ?? null,
        macdHist: maps.macdHist.get(candle.time) ?? null,
      });
    }

    return () => {
      unsubCross();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      metaRef.current = { symbol: '', interval: '', len: 0, first: 0, paramsKey: '' };
    };
  }, [chartKey]);

  // ---------- ডেটা ও ইন্ডিকেটর আপডেট ----------
  useEffect(() => {
    const chart = chartRef.current;
    const s = seriesRef.current;
    if (!chart || !s) return;

    const paramsKey = JSON.stringify({
      ema: cfg.ema.enabled ? cfg.ema.params : null,
      bb: cfg.bb.enabled ? cfg.bb.params : null,
      rsi: cfg.rsi.enabled ? cfg.rsi.params : null,
      macd: cfg.macd.enabled ? cfg.macd.params : null,
    });

    // ইন্ডিকেটর দৃশ্যমানতা
    s.ema1.applyOptions({ visible: cfg.ema.enabled });
    s.ema2.applyOptions({ visible: cfg.ema.enabled });
    s.bbU.applyOptions({ visible: cfg.bb.enabled });
    s.bbM.applyOptions({ visible: cfg.bb.enabled });
    s.bbL.applyOptions({ visible: cfg.bb.enabled });

    const meta = metaRef.current;
    const fullSet =
      candles.length === 0 ||
      meta.symbol !== symbol ||
      meta.interval !== interval ||
      meta.len !== candles.length ||
      (candles.length > 0 && meta.first !== candles[0].time) ||
      meta.paramsKey !== paramsKey;

    if (candles.length === 0) {
      s.candle.setData([]);
      s.volume.setData([]);
      s.ema1.setData([]); s.ema2.setData([]);
      s.bbU.setData([]); s.bbM.setData([]); s.bbL.setData([]);
      s.rsi?.setData([]); s.macdLine?.setData([]); s.macdSig?.setData([]); s.macdHist?.setData([]);
      metaRef.current = { symbol, interval, len: 0, first: 0, paramsKey };
      return;
    }

    const times = candles.map((c) => c.time as UTCTimestamp);
    const cl = closes(candles);
    const maps = legendMapsRef.current;

    if (fullSet) {
      // ক্যান্ডেল ও ভলিউম
      s.candle.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })));
      s.volume.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.4)',
        }))
      );

      const byTime = new Map<number, Candle>();
      for (const c of candles) byTime.set(c.time, c);
      candleByTimeRef.current = byTime;

      // EMA
      if (cfg.ema.enabled) {
        const [p1, p2] = cfg.ema.params.periods;
        const pts1 = toLinePoints(times, ema(cl, p1));
        const pts2 = toLinePoints(times, ema(cl, p2));
        s.ema1.setData(pts1);
        s.ema2.setData(pts2);
        maps.ema1 = mapFromPoints(pts1);
        maps.ema2 = mapFromPoints(pts2);
      } else {
        s.ema1.setData([]); s.ema2.setData([]);
        maps.ema1 = new Map(); maps.ema2 = new Map();
      }

      // Bollinger Bands
      if (cfg.bb.enabled) {
        const bb = bollinger(cl, cfg.bb.params.period, cfg.bb.params.mult);
        const u = toLinePoints(times, bb.upper);
        const m = toLinePoints(times, bb.middle);
        const l = toLinePoints(times, bb.lower);
        s.bbU.setData(u); s.bbM.setData(m); s.bbL.setData(l);
        maps.bbU = mapFromPoints(u); maps.bbM = mapFromPoints(m); maps.bbL = mapFromPoints(l);
      } else {
        s.bbU.setData([]); s.bbM.setData([]); s.bbL.setData([]);
        maps.bbU = new Map(); maps.bbM = new Map(); maps.bbL = new Map();
      }

      // RSI
      if (s.rsi && cfg.rsi.enabled) {
        const pts = toLinePoints(times, rsi(cl, cfg.rsi.params.period));
        s.rsi.setData(pts);
        maps.rsi = mapFromPoints(pts);
      } else if (s.rsi) {
        s.rsi.setData([]);
        maps.rsi = new Map();
      }

      // MACD
      if (s.macdHist && s.macdLine && s.macdSig && cfg.macd.enabled) {
        const m = macd(cl, cfg.macd.params.fast, cfg.macd.params.slow, cfg.macd.params.signal);
        const hist: { time: number; value: number; color: string }[] = [];
        for (let i = 0; i < times.length; i++) {
          const v = m.histogram[i];
          if (v != null) {
            hist.push({ time: times[i] as number, value: v, color: v >= 0 ? 'rgba(14,203,129,0.55)' : 'rgba(246,70,93,0.55)' });
          }
        }
        const ml = toLinePoints(times, m.macd);
        const sg = toLinePoints(times, m.signal);
        s.macdHist.setData(hist);
        s.macdLine.setData(ml);
        s.macdSig.setData(sg);
        maps.macdHist = mapFromPoints(hist);
        maps.macd = mapFromPoints(ml);
        maps.macdSig = mapFromPoints(sg);
      } else if (s.macdHist && s.macdLine && s.macdSig) {
        s.macdHist.setData([]); s.macdLine.setData([]); s.macdSig.setData([]);
        maps.macdHist = new Map(); maps.macd = new Map(); maps.macdSig = new Map();
      }

      // সিম্বল/টাইমফ্রেম পরিবর্তনে ভিউ রিসেট
      if (meta.symbol !== symbol || meta.interval !== interval) {
        chart.timeScale().fitContent();
      }
    } else {
      // incremental — শুধু শেষ বার আপডেট
      const last = candles[candles.length - 1];
      s.candle.update({ time: last.time as UTCTimestamp, open: last.open, high: last.high, low: last.low, close: last.close });
      s.volume.update({
        time: last.time as UTCTimestamp,
        value: last.volume,
        color: last.close >= last.open ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.4)',
      });
      candleByTimeRef.current.set(last.time, last);

      const t = last.time as number;
      if (cfg.ema.enabled) {
        const [p1, p2] = cfg.ema.params.periods;
        const v1 = lastValue(ema(cl, p1));
        const v2 = lastValue(ema(cl, p2));
        if (v1 != null) s.ema1.update({ time: t as UTCTimestamp, value: v1 });
        if (v2 != null) s.ema2.update({ time: t as UTCTimestamp, value: v2 });
        if (v1 != null) maps.ema1.set(t, v1);
        if (v2 != null) maps.ema2.set(t, v2);
      }
      if (cfg.bb.enabled) {
        const bb = bollinger(cl, cfg.bb.params.period, cfg.bb.params.mult);
        const vu = lastValue(bb.upper), vm = lastValue(bb.middle), vl = lastValue(bb.lower);
        if (vu != null) { s.bbU.update({ time: t as UTCTimestamp, value: vu }); maps.bbU.set(t, vu); }
        if (vm != null) { s.bbM.update({ time: t as UTCTimestamp, value: vm }); maps.bbM.set(t, vm); }
        if (vl != null) { s.bbL.update({ time: t as UTCTimestamp, value: vl }); maps.bbL.set(t, vl); }
      }
      if (s.rsi && cfg.rsi.enabled) {
        const v = lastValue(rsi(cl, cfg.rsi.params.period));
        if (v != null) { s.rsi.update({ time: t as UTCTimestamp, value: v }); maps.rsi.set(t, v); }
      }
      if (s.macdHist && s.macdLine && s.macdSig && cfg.macd.enabled) {
        const m = macd(cl, cfg.macd.params.fast, cfg.macd.params.slow, cfg.macd.params.signal);
        const h = lastValue(m.histogram), ml = lastValue(m.macd), sg = lastValue(m.signal);
        if (h != null) { s.macdHist.update({ time: t as UTCTimestamp, value: h, color: h >= 0 ? 'rgba(14,203,129,0.55)' : 'rgba(246,70,93,0.55)' }); maps.macdHist.set(t, h); }
        if (ml != null) { s.macdLine.update({ time: t as UTCTimestamp, value: ml }); maps.macd.set(t, ml); }
        if (sg != null) { s.macdSig.update({ time: t as UTCTimestamp, value: sg }); maps.macdSig.set(t, sg); }
      }
    }

    metaRef.current = { symbol, interval, len: candles.length, first: candles[0].time, paramsKey };
  }, [candles, configs, chartKey, symbol, interval]);

  // ---------- রেন্ডার ----------
  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const shown = legend ?? (lastCandle
    ? {
        time: lastCandle.time,
        open: lastCandle.open, high: lastCandle.high, low: lastCandle.low, close: lastCandle.close, volume: lastCandle.volume,
        ema1: null, ema2: null, bbU: null, bbM: null, bbL: null, rsi: null, macd: null, macdSig: null, macdHist: null,
      }
    : null);

  const up = shown ? shown.close >= shown.open : true;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* লিজেন্ড ওভারলে */}
      {shown && (
        <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded bg-black/35 px-2.5 py-1.5 text-[11px] leading-4 backdrop-blur-sm">
          <span className="font-semibold text-neutral-200">{symbol.replace('USDT', '/USDT')} · {interval}</span>
          <span className="text-neutral-500">O <span className={up ? 'text-[#0ECB81]' : 'text-[#F6465D]'}>{formatPrice(shown.open)}</span></span>
          <span className="text-neutral-500">H <span className={up ? 'text-[#0ECB81]' : 'text-[#F6465D]'}>{formatPrice(shown.high)}</span></span>
          <span className="text-neutral-500">L <span className={up ? 'text-[#0ECB81]' : 'text-[#F6465D]'}>{formatPrice(shown.low)}</span></span>
          <span className="text-neutral-500">C <span className={up ? 'text-[#0ECB81]' : 'text-[#F6465D]'}>{formatPrice(shown.close)}</span></span>
          <span className="text-neutral-500">Vol <span className="text-neutral-300">{formatCompact(shown.volume)}</span></span>
          {cfg.ema.enabled && shown.ema1 != null && (
            <span style={{ color: COLORS.ema1 }}>EMA{cfg.ema.params.periods[0]} {formatPrice(shown.ema1)}</span>
          )}
          {cfg.ema.enabled && shown.ema2 != null && (
            <span style={{ color: COLORS.ema2 }}>EMA{cfg.ema.params.periods[1]} {formatPrice(shown.ema2)}</span>
          )}
          {cfg.bb.enabled && shown.bbU != null && (
            <span style={{ color: COLORS.bb }}>BB {formatPrice(shown.bbL ?? 0)} – {formatPrice(shown.bbU)}</span>
          )}
          {cfg.rsi.enabled && shown.rsi != null && (
            <span style={{ color: COLORS.ema1 }}>RSI {shown.rsi.toFixed(1)}</span>
          )}
          {cfg.macd.enabled && shown.macd != null && (
            <span>
              <span style={{ color: COLORS.macdLine }}>MACD {shown.macd.toFixed(4)}</span>
              <span className="text-neutral-500"> · Sig {shown.macdSig?.toFixed(4) ?? '—'} · Hist {shown.macdHist?.toFixed(4) ?? '—'}</span>
            </span>
          )}
        </div>
      )}

      {/* লোডিং ওভারলে */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#0B0D10]/80">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FCD535] border-t-transparent" />
          <p className="text-sm text-neutral-400">মার্কেট ডেটা লোড হচ্ছে…</p>
        </div>
      )}

      {/* ত্রুটি ওভারলে */}
      {!loading && error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#0B0D10]/90 px-6 text-center">
          <p className="text-sm text-[#F6465D]">{error}</p>
          <button
            onClick={onRetry}
            className="rounded-md bg-[#FCD535] px-4 py-2 text-sm font-medium text-black transition hover:brightness-110"
          >
            আবার চেষ্টা করুন
          </button>
        </div>
      )}
    </div>
  );
}
