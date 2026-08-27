// P2-28: pure/testable pieces of the auth rate limiter's client-IP trust
// logic and in-memory DB-outage fallback. Extracted from auth/index.ts so
// this can be unit-tested without needing bcryptjs or a live Deno.serve
// handler — the DB-backed check itself (check_rate_limit RPC) stays in
// auth/index.ts, which is the only place with a supabase client.

// Trust assumption: the browser calls this function's *.supabase.co URL
// directly — there is no CDN/WAF of ours in front of it, so Supabase's own
// gateway is the only hop between the internet and this function. A
// standards-following proxy *appends* the IP it actually observed to
// X-Forwarded-For rather than trusting/overwriting whatever arrived, so the
// LAST entry is the one Supabase's gateway itself recorded — not
// client-forgeable — while the FIRST entry is exactly the part a client can
// set themselves. Trust the last entry, not the first.
export function clientIp(req: Request): string | null {
  const header = req.headers.get('x-forwarded-for');
  if (!header) return null;
  const parts = header.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

// Never collapse every client missing an IP into one shared "unknown"
// bucket — that would let one client's traffic exhaust the limit for every
// other client lacking the header (a real, if narrow, denial-of-service
// vector). A per-request random suffix means an unidentifiable request
// isn't limited against anyone else's traffic — it simply isn't limited at
// all, a deliberate narrow trade-off, not a silent shared-bucket gap.
export function rateLimitBucket(prefix: string, req: Request): string {
  const ip = clientIp(req);
  return ip ? `${prefix}:${ip}` : `${prefix}:unknown:${crypto.randomUUID()}`;
}

// In-memory-only, per warm Edge Function instance, engaged only when the
// DB-backed limiter itself errors. Resets on cold start, so it is not a
// substitute for the persisted limiter — only a narrower fail-open window
// than "let every request through on any DB hiccup." Deliberately applied
// uniformly across every auth endpoint rather than a per-endpoint
// fail-closed/fail-open split, which would add real complexity for limited
// additional protection given this fallback already bounds every endpoint.
const inMemoryRateLimitFallback = new Map<string, { count: number; windowStartMs: number }>();

export function inMemoryRateLimitOk(bucket: string, max: number, windowSeconds: number, nowMs: number = Date.now()): boolean {
  const entry = inMemoryRateLimitFallback.get(bucket);
  if (!entry || nowMs - entry.windowStartMs > windowSeconds * 1000) {
    inMemoryRateLimitFallback.set(bucket, { count: 1, windowStartMs: nowMs });
    return true;
  }
  entry.count++;
  return entry.count <= max;
}

/** Test-only: clears the in-memory fallback state between test cases. */
export function _resetInMemoryRateLimitFallback(): void {
  inMemoryRateLimitFallback.clear();
}
