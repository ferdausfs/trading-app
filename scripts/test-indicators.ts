/**
 * ইন্ডিকেটর গাণিতিক সঠিকতা টেস্ট — হাতে-গোনা মানের সাথে তুলনা।
 * চালান: bun scripts/test-indicators.ts
 */
import { ema, sma, rsi, macd, bollinger, toLinePoints } from '../src/lib/indicators';

let pass = 0;
let fail = 0;

function assert(name: string, actual: unknown, expected: unknown, tol = 1e-9) {
  const ok =
    typeof expected === 'number' && typeof actual === 'number'
      ? Math.abs((actual as number) - (expected as number)) <= tol
      : Object.is(actual, expected);
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} — expected=${expected}, actual=${actual}`);
  }
}

// ---------- EMA ----------
console.log('EMA(5) on [1..10]:');
{
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const e = ema(v, 5);
  assert('null prefix দৈর্ঘ্য', e.slice(0, 4).filter((x) => x !== null).length, 0);
  assert('seed (SMA5 @ idx4) = 3', e[4]!, 3);
  const k = 2 / 6; // 1/3
  // idx5: (6-3)*k+3 = 4 ; idx6: 5 ; idx7: 6 ; idx8: 7 ; idx9: 8
  assert('idx5 = 4', e[5]!, 4);
  assert('idx6 = 5', e[6]!, 5);
  assert('idx9 = 8', e[9]!, 8, 1e-9);
  assert('k = 1/3', k, 1 / 3);
}
console.log('EMA insufficient data:');
assert('৩ পয়েন্টে EMA(5) → সব null', ema([1, 2, 3], 5).every((x) => x === null), true);

// ---------- SMA ----------
console.log('SMA(5) on [1..10]:');
{
  const s = sma([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
  assert('idx3 = null', s[3], null);
  assert('idx4 = 3', s[4]!, 3);
  assert('idx9 = 8', s[9]!, 8);
}

// ---------- RSI ----------
console.log('RSI(14):');
{
  // সবসময় ঊর্ধ্বমুখী সিরিজ → RSI = 100
  const up = Array.from({ length: 30 }, (_, i) => 100 + i);
  const r1 = rsi(up, 14);
  assert('শুধু বৃদ্ধি → RSI = 100', r1[14]!, 100);
  // সবসময় নিম্নমুখী → RSI = 0
  const down = Array.from({ length: 30 }, (_, i) => 100 - i);
  const r2 = rsi(down, 14);
  assert('শুধু হ্রাস → RSI = 0', r2[14]!, 0);
  // অল্টারনেটিং +1/−1: Wilder smoothing এ আউটপুটটি 50 কে কেন্দ্র করে
  // ±৩.৭ সীমার limit cycle এ দোলে খায় (steady-state আচরণ) — তাই 50±4 রেঞ্জ চেক
  const alt = Array.from({ length: 200 }, (_, i) => 100 + (i % 2 === 0 ? 0 : 1));
  const r3 = rsi(alt, 14);
  assert('অল্টারনেটিং → RSI limit cycle (50±4) এর ভিতরে', Math.abs(r3[199]! - 50) <= 4, true);
  assert('null prefix (idx13)', r3[13], null);
  // সমতল টেইল: শূন্য diff এ Wilder smoothing avgGain/avgLoss এর অনুপাত সংরক্ষণ করে
  // (exponential decay অনুপাত বদলায় না) — তাই RSI 50 এর কাছাকাছি স্থিতিশীল থাকে, হুবহু 50 নয়
  const flatTail = [
    ...Array.from({ length: 100 }, (_, i) => 100 + (i % 2 === 0 ? 0 : 1)),
    ...Array.from({ length: 100 }, () => 100.5),
  ];
  const r4 = rsi(flatTail, 14);
  assert('সমতল টেইল → RSI নিউট্রালের কাছে স্থিতিশীল (50±3)', Math.abs(r4[199]! - 50) <= 3, true);
  // শুরু থেকেই সম্পূর্ণ সমতল → নিউট্রাল 50
  const flat = new Array(30).fill(42);
  const r5 = rsi(flat, 14);
  assert('সম্পূর্ণ সমতল সিরিজ → RSI = 50', r5[14]!, 50);
  // হাতে-গোনা: [2,4,6,8,10,8,6,4,2,4,...] period=5
  // প্রথম ৫টি diff: +2,+2,+2,+2,−2 → avgGain=1.6, avgLoss=0.4, RS=4 → RSI=80 @ idx5
  const r6 = rsi([2, 4, 6, 8, 10, 8, 6, 4, 2, 4, 6, 8, 10, 12, 14], 5);
  assert('হাতে-গোনা: idx5 = 80', r6[5]!, 80);
}

// ---------- MACD ----------
console.log('MACD(3,6,3) on [1..12] (ছোট প্যারামে হাতে-গোনা):');
{
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const m = macd(v, 3, 6, 3);
  // emaFast null শেষ ইনডেক্স 2, emaSlow null শেষ ইনডেক্স 5 → MACD null শেষ ইনডেক্স 5
  assert('MACD idx4 = null', m.macd[4], null);
  const slow = ema(v, 6);
  const fast = ema(v, 3);
  const expectMacd5 = fast[5]! - slow[5]!;
  assert('MACD idx5 = fast−slow', m.macd[5]!, expectMacd5);
  // Signal: MACD সিরিজের (idx5 থেকে) EMA(3)
  const compact = (m.macd.slice(5) as number[]);
  const sig = ema(compact, 3);
  assert('Signal idx5 = seed', m.signal[5]!, sig[0]!);
  assert('Signal idx6 = sig[1]', m.signal[6]!, sig[1]!);
  const expectHist7 = m.macd[7]! - m.signal[7]!;
  assert('Hist idx7 = macd − signal', m.histogram[7]!, expectHist7);
}

// ---------- Bollinger ----------
console.log('Bollinger(5, 2) on [1..10]:');
{
  const b = bollinger([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5, 2);
  assert('middle idx3 = null', b.middle[3], null);
  assert('middle idx4 = 3', b.middle[4]!, 3);
  const sd = Math.sqrt(2); // [1..5] এর population stddev
  assert('upper idx4 = 3 + 2√2', b.upper[4]!, 3 + 2 * sd, 1e-12);
  assert('lower idx4 = 3 − 2√2', b.lower[4]!, 3 - 2 * sd, 1e-12);
  assert('middle idx9 = 8', b.middle[9]!, 8);
}

// ---------- toLinePoints ----------
console.log('toLinePoints:');
{
  const pts = toLinePoints([10, 11, 12, 13], [null, 5, null, 7]);
  assert('null বাদ দিয়ে ২টি পয়েন্ট', pts.length, 2);
  assert('প্রথম পয়েন্ট time=11', pts[0].time, 11);
}

console.log(`\nফলাফল: ${pass} পাস, ${fail} ফেল`);
process.exit(fail > 0 ? 1 : 0);
