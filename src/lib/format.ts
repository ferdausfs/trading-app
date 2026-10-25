/**
 * সংখ্যা ও সময় ফরম্যাটিং হেল্পার।
 * ট্রেডিং কনভেনশন অনুযায়ী দাম ও সংখ্যা en-US লোকেলে দেখানো হয়
 * (হাজার আলাদা করার কমা, কমপ্যাক্ট ভলিউম) — এটি ট্রেডিং প্ল্যাটফর্মের আন্তর্জাতিক স্ট্যান্ডার্ড।
 */

export function formatPrice(price: number): string {
  if (!Number.isFinite(price)) return '—';
  const abs = Math.abs(price);
  let decimals = 2;
  if (abs < 0.0001) decimals = 8;
  else if (abs < 0.01) decimals = 6;
  else if (abs < 1) decimals = 4;
  else if (abs >= 10000) decimals = 1;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals > 2 ? 2 : decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

export function formatPercent(pct: number): string {
  if (!Number.isFinite(pct)) return '—';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}

/** ইউনিক্স সেকেন্ড → স্থানীয় সময় (বাংলাদেশ কনটেক্সটে ব্রাউজারের লোকেল অনুসরণ) */
export function formatTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleTimeString('bn-BD', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString('bn-BD', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
