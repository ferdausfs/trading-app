/**
 * সরল ইন-মেমরি Rate Limiter — প্রতি IP-তে স্লাইডিং উইন্ডো ভিত্তিক।
 * API অপব্যবহার প্রতিরোধে ব্যবহৃত (স্পেসিফিকেশনের সিকিউরিটি আইটেম)।
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

// পুরনো বাকেট পরিষ্কারের জন্য সর্বোচ্চ সাইজ
const MAX_BUCKETS = 5000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * @param key    ইউনিক আইডেন্টিফায়ার (সাধারণত client IP + route)
 * @param limit  উইন্ডোতে সর্বোচ্চ অনুরোধ সংখ্যা
 * @param windowMs উইন্ডো আকার (মিলিসেকেন্ড)
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size > MAX_BUCKETS) buckets.clear(); // সরল overflow গার্ড
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  // উইন্ডোর বাইরের টাইমস্ট্যাম্প বাদ
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  bucket.timestamps.push(now);
  return {
    allowed: true,
    remaining: limit - bucket.timestamps.length,
    retryAfterSec: 0,
  };
}

/** প্রক্সি হেডার সমেত ক্লায়েন্ট IP বের করা */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
