/**
 * CandleChart — react-native-svg দিয়ে কাস্টম ক্যান্ডেলস্টিক চার্ট।
 * ক্যান্ডেল + EMA লাইন + ভলিউম বার। শেষ N বার দেখায় (মসৃণ পারফরম্যান্স)।
 */

import React, { useMemo } from 'react';
import Svg, { Rect, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { View, Text } from 'react-native';
import { ema } from '../lib/indicators';
import { COLORS } from '../config';

const WIDTH = 360;
const HEIGHT = 320;
const PADDING_R = 56;
const PADDING_T = 10;
const PADDING_B = 46; // ভলিউম + সময় লেবেল
const VOL_H = 36;

export default function CandleChart({ candles = [], emaPeriods = [20, 50], maxBars = 60 }) {
  const model = useMemo(() => {
    if (!candles.length) return null;
    const bars = candles.slice(-maxBars);
    const closes = candles.map((c) => c.close);
    const e1 = ema(closes, emaPeriods[0]).slice(-maxBars);
    const e2 = ema(closes, emaPeriods[1]).slice(-maxBars);

    let hi = -Infinity;
    let lo = Infinity;
    let maxVol = 0;
    for (const b of bars) {
      if (b.high > hi) hi = b.high;
      if (b.low < lo) lo = b.low;
      if (b.volume > maxVol) maxVol = b.volume;
    }
    const range = hi - lo || 1;
    const chartH = HEIGHT - PADDING_T - PADDING_B;
    const plotW = WIDTH - PADDING_R;
    const step = plotW / bars.length;
    const bodyW = Math.max(2, step * 0.62);
    const y = (price) => PADDING_T + ((hi - price) / range) * chartH;
    const x = (i) => i * step + step / 2;

    return { bars, e1, e2, hi, lo, maxVol, chartH, plotW, step, bodyW, y, x };
  }, [candles, emaPeriods, maxBars]);

  if (!model) {
    return (
      <View style={{ height: HEIGHT, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg }}>
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>ডেটা লোড হচ্ছে…</Text>
      </View>
    );
  }

  const { bars, e1, e2, hi, lo, maxVol, chartH, y, x, bodyW, step } = model;

  const gridPrices = [hi, (hi + lo) / 2, lo];
  const last = bars[bars.length - 1];
  const lastUp = last.close >= last.open;

  const linePts = (arr) =>
    arr
      .map((v, i) => (v != null ? `${x(i)},${y(v)}` : null))
      .filter(Boolean)
      .join(' ');

  return (
    <View style={{ backgroundColor: COLORS.bg }}>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {/* গ্রিড ও দাম লেবেল */}
        {gridPrices.map((p, i) => (
          <React.Fragment key={i}>
            <Line
              x1={0} x2={WIDTH - PADDING_R}
              y1={y(p)} y2={y(p)}
              stroke={COLORS.border} strokeWidth={1}
            />
            <SvgText x={WIDTH - PADDING_R + 6} y={y(p) + 4} fill={COLORS.muted} fontSize={9}>
              {p >= 1000 ? p.toFixed(0) : p.toFixed(2)}
            </SvgText>
          </React.Fragment>
        ))}

        {/* ভলিউম বার */}
        {bars.map((b, i) => {
          const h = maxVol > 0 ? (b.volume / maxVol) * VOL_H : 0;
          return (
            <Rect
              key={`v${i}`}
              x={x(i) - bodyW / 2}
              y={HEIGHT - 26 - h}
              width={bodyW}
              height={h}
              fill={b.close >= b.open ? 'rgba(14,203,129,0.45)' : 'rgba(246,70,93,0.45)'}
            />
          );
        })}

        {/* EMA লাইন */}
        <Polyline points={linePts(e1)} fill="none" stroke={COLORS.ema1} strokeWidth={1.6} />
        <Polyline points={linePts(e2)} fill="none" stroke={COLORS.ema2} strokeWidth={1.6} />

        {/* ক্যান্ডেল */}
        {bars.map((b, i) => {
          const up = b.close >= b.open;
          const color = up ? COLORS.up : COLORS.down;
          const top = y(Math.max(b.open, b.close));
          const bot = y(Math.min(b.open, b.close));
          return (
            <React.Fragment key={`c${i}`}>
              <Line x1={x(i)} x2={x(i)} y1={y(b.high)} y2={y(b.low)} stroke={color} strokeWidth={1} />
              <Rect
                x={x(i) - bodyW / 2}
                y={top}
                width={bodyW}
                height={Math.max(1, bot - top)}
                fill={color}
              />
            </React.Fragment>
          );
        })}

        {/* শেষ দামের ড্যাশ লাইন */}
        <Line
          x1={0} x2={WIDTH - PADDING_R}
          y1={y(last.close)} y2={y(last.close)}
          stroke={lastUp ? COLORS.up : COLORS.down}
          strokeWidth={1} strokeDasharray="4,3"
        />
      </Svg>

      <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingBottom: 4 }}>
        <Text style={{ color: COLORS.ema1, fontSize: 10 }}>EMA{emaPeriods[0]}</Text>
        <Text style={{ color: COLORS.ema2, fontSize: 10, marginLeft: 10 }}>EMA{emaPeriods[1]}</Text>
        <Text style={{ color: COLORS.muted, fontSize: 10, marginLeft: 'auto' }}>
          সর্বোচ্চ {hi.toFixed(2)} · সর্বনিম্ন {lo.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}
