type Bucket = {
  tokens: number;
  lastRefill: number;
};

const buckets = new Map<string, Bucket>();

type RateLimitOptions = {
  /** Maximum number of requests allowed within the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
};

/**
 * Very small, in-memory token bucket rate limiter intended for MVP deployments.
 * This is per-process and resets on deploy; it is not a replacement for
 * provider-level or CDN-level rate limiting.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): boolean {
  const now = Date.now();
  const windowMs = options.windowMs;
  const max = options.limit;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: max, lastRefill: now };
    buckets.set(key, bucket);
  }

  const elapsed = now - bucket.lastRefill;
  if (elapsed >= windowMs) {
    bucket.tokens = max;
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    return false;
  }

  bucket.tokens -= 1;
  return true;
}

