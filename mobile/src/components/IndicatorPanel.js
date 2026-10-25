/**
 * IndicatorPanel (মোবাইল) — ইন্ডিকেটর টগল ও প্যারামিটার প্রদর্শন।
 */

import React from 'react';
import { View, Text, Switch, TextInput, StyleSheet } from 'react-native';
import { COLORS } from '../config';

const LABELS = {
  ema: 'EMA',
  bb: 'Bollinger Bands',
  rsi: 'RSI',
  macd: 'MACD',
};

export default function IndicatorPanel({ configs, onChange }) {
  if (!configs) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>ইন্ডিকেটর</Text>
      {Object.values(configs).map((cfg) => (
        <View key={cfg.key} style={styles.row}>
          <View style={styles.leftCol}>
            <View style={[styles.dot, { backgroundColor: cfg.key === 'ema' || cfg.key === 'rsi' ? COLORS.accent : COLORS.bb }]} />
            <Text style={styles.name}>{LABELS[cfg.key]}</Text>
          </View>
          <Switch
            value={cfg.enabled}
            onValueChange={(v) => onChange(cfg.key, { enabled: v })}
            thumbColor={cfg.enabled ? COLORS.accent : COLORS.muted}
            trackColor={{ false: COLORS.border, true: '#3d3517' }}
          />
        </View>
      ))}

      {configs.ema?.enabled && (
        <View style={styles.params}>
          <Text style={styles.paramLabel}>EMA পিরিয়ড (কমা দিয়ে): </Text>
          <TextInput
            style={styles.input}
            value={configs.ema.params.periods.join(',')}
            keyboardType="number-pad"
            onChangeText={(t) => {
              const parts = t.split(',').map((n) => parseInt(n, 10));
              onChange('ema', {
                params: {
                  periods: [
                    Number.isFinite(parts[0]) ? parts[0] : 20,
                    Number.isFinite(parts[1]) ? parts[1] : 50,
                  ],
                },
              });
            }}
          />
        </View>
      )}
      {configs.rsi?.enabled && (
        <Text style={styles.hint}>RSI পিরিয়ড: {configs.rsi.params.period} · ৩০/৭০ লেভেল</Text>
      )}
      {configs.macd?.enabled && (
        <Text style={styles.hint}>
          MACD {configs.macd.params.fast}/{configs.macd.params.slow}/{configs.macd.params.signal}
        </Text>
      )}
      {configs.bb?.enabled && (
        <Text style={styles.hint}>
          BB {configs.bb.params.period} × {configs.bb.params.mult} StdDev
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: COLORS.panel, borderRadius: 10, padding: 12, marginTop: 10 },
  heading: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  leftCol: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  name: { color: COLORS.text, fontSize: 13 },
  params: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  paramLabel: { color: COLORS.muted, fontSize: 11 },
  input: {
    backgroundColor: COLORS.bg, color: COLORS.text, fontSize: 12, paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, minWidth: 70,
  },
  hint: { color: COLORS.muted, fontSize: 11, marginTop: 6 },
});
