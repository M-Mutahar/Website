// A minimal, honest mitigation for the "two simultaneous requests both
// spend OCR/Claude cost before the credit check rejects one" risk — see
// the comment above the lock acquisition in app/api/extract/route.ts for
// the full explanation of why a real reservation system wasn't built for
// this MVP.
//
// This only catches the common case: the same user's two requests landing
// on the SAME warm serverless instance. It does not stop two requests
// landing on two different instances (Vercel doesn't share memory across
// them), and a cold start wipes this Set entirely. It's a real reduction
// in the window for casual abuse, not a guarantee — same honesty as
// lib/rate-limit.ts, which has the identical limitation.
const inFlight = new Set<string>();

export function tryAcquireInFlightLock(userId: string): boolean {
  if (inFlight.has(userId)) return false;
  inFlight.add(userId);
  return true;
}

export function releaseInFlightLock(userId: string): void {
  inFlight.delete(userId);
}
