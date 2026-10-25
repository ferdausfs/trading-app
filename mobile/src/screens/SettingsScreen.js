/**
 * SettingsScreen (মোবাইল) — সার্ভার সংযোগ তথ্য ও অ্যাপ নির্দেশিকা।
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { API_BASE, SOCKET_URL, COLORS } from '../config';

export default function SettingsScreen() {
  const [api, setApi] = useState(API_BASE);
  const [sock, setSock] = useState(SOCKET_URL);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 14 }}>
      <Text style={styles.heading}>সার্ভার কনফিগারেশন</Text>
      <Text style={styles.label}>API বেস URL (Next.js ব্যাকএন্ড)</Text>
      <TextInput style={styles.input} value={api} onChangeText={setApi} autoCapitalize="none" />
      <Text style={styles.label}>Socket.IO রিলে URL</Text>
      <TextInput style={styles.input} value={sock} onChangeText={setSock} autoCapitalize="none" />

      <Text style={styles.note}>
        এই মানগুলো সাধারণত src/config.js ফাইলে সেট করা হয়। লোকাল টেস্টিংয়ের জন্য
        একই Wi-Fi এ থাকলে কম্পিউটারের LAN IP ব্যবহার করুন (যেমন http://192.168.1.10:3000)।
        Android Emulator-এ 10.0.2.2 হলো হোস্ট মেশিনের localhost।
      </Text>

      <Text style={styles.heading}>কীভাবে কাজ করে</Text>
      <Text style={styles.bullet}>• হিস্টরিক্যাল ক্যান্ডেল: REST /api/market/klines (Binance প্রক্সি)</Text>
      <Text style={styles.bullet}>• লাইভ আপডেট: Socket.IO → market-relay → Binance WebSocket</Text>
      <Text style={styles.bullet}>• ইন্ডিকেটর: EMA, RSI, MACD, Bollinger Bands (ওয়েবের সাথে একই সূত্র)</Text>
      <Text style={styles.bullet}>• APK বিল্ড: eas build -p android --profile preview</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  heading: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  label: { color: COLORS.muted, fontSize: 12, marginTop: 8 },
  input: {
    backgroundColor: COLORS.panel, color: COLORS.text, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13,
  },
  note: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 12 },
  bullet: { color: COLORS.text, fontSize: 12, lineHeight: 20 },
});
