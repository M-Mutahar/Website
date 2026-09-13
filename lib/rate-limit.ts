// A minimal in-memory sliding-window limiter. This stops the obvious abuse
// case (one user/IP hammering the extraction endpoint) for free, with zero
// added infrastructure.
//
// HONEST LIMITATION (per your "explain if it's not reliable on Vercel"
// requirement): Vercel serverless functions don't share memory across
// instances, and a cold start wipes this Map entirely. Under real traffic
// with multiple concurrent instances, this limiter is "best effort" —
// it will catch a single abusive client hitting one warm instance
// repeatedly, but a distributed or cold-start-heavy abuse pattern can slip
// past it. If you need a real guarantee, add Upstash Redis's rate-limit
// package later — it's a small, cheap addition, not a rearchitecture.

const buckets = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  buckets.set(key, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}
