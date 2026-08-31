// R2 (§5.2). Warm-instance token-bucket-style pacing, shared across a single
// scan's query cascade AND across shelf items (the pool in claude-proxy's
// handleShelfScan). The current throttling is self-inflicted — the scanner
// trips its own limit with its own cascade, not a hostile third party — so
// the fix is pacing our own outbound rate, not retrying harder after the
// fact (externalCall.ts's retry policy is the safety net; this is the fix).
//
// Module-level state — this is intentionally warm-instance-only and resets
// on cold start. That is an accepted, honestly-documented tradeoff (task
// doc §5.2): a cold instance re-learns the real ceiling from the next
// response's rate-limit headers instead of carrying stale state forever.

interface ProviderRateState {
  nextAllowedAt: number   // Date.now()-comparable ms timestamp
  minIntervalMs: number   // spacing enforced between requests to this provider
}

// Conservative until a real response's headers teach us the actual ceiling
// (see noteRateLimitHeaders). No provider's true burst/per-second rate has
// been measured — R0 only measured Trawl's *monthly* request quota, not its
// throttle rate — so this is a deliberately cautious starting point, not a
// calibrated constant. Tune once real headers are observed in production.
const DEFAULT_MIN_INTERVAL_MS = 300;
// Absent an explicit reset signal, a "remaining: 0" response backs off this
// long before trying that provider again — conservative, never a guess at
// the provider's real window length.
const QUOTA_EXHAUSTED_FALLBACK_BACKOFF_MS = 60_000;

const state = new Map<string, ProviderRateState>();

function getState(providerId: string): ProviderRateState {
  let s = state.get(providerId);
  if (!s) {
    s = { nextAllowedAt: 0, minIntervalMs: DEFAULT_MIN_INTERVAL_MS };
    state.set(providerId, s);
  }
  return s;
}

function parseHeaderNumber(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// A rate-limit reset header is, across real-world APIs, either seconds
// until reset (a delta) or a Unix epoch in seconds — not consistently one
// or the other, and neither Trawl's nor SoldComps.com's exact convention has
// been live-verified for this header (see soldCompsProvider.ts's own "not
// verified live" notes). Disambiguate the same way externalCall.ts's
// Retry-After parsing does: a value large enough to be an epoch (>1e12ms,
// i.e. after the year 2001) is treated as one; anything smaller is a delta.
function resolveResetAt(resetHeader: number | null, now: number): number | null {
  if (resetHeader === null) return null;
  const asEpochMs = resetHeader * 1000;
  return asEpochMs > 1_000_000_000_000 ? asEpochMs : now + resetHeader * 1000;
}

/**
 * Seeds this provider's pacing from a real response's rate-limit headers
 * (X-RateLimit-Limit/-Remaining/-Reset). Never throws, never blocks —
 * best-effort only. Call after every request to the provider, success or
 * failure. A provider that never sends these headers simply leaves the
 * conservative default untouched forever — that is correct, not a bug.
 */
export function noteRateLimitHeaders(providerId: string, h: Headers): void {
  const remaining = parseHeaderNumber(h.get('X-RateLimit-Remaining'));
  const resetHeader = parseHeaderNumber(h.get('X-RateLimit-Reset'));
  if (remaining === null && resetHeader === null) return;

  const now = Date.now();
  const s = getState(providerId);
  const resetAt = resolveResetAt(resetHeader, now);

  if (remaining !== null && remaining <= 0) {
    // Budget spent for this window — do not send another request until the
    // provider's own reset signal, or a conservative fallback absent one.
    s.nextAllowedAt = Math.max(s.nextAllowedAt, resetAt ?? now + QUOTA_EXHAUSTED_FALLBACK_BACKOFF_MS);
    return;
  }
  if (remaining !== null && remaining > 0 && resetAt !== null) {
    // Spread the remaining budget evenly across the time left in the
    // window, floored at the conservative default so a generous-looking
    // remaining count never causes a burst.
    s.minIntervalMs = Math.max(DEFAULT_MIN_INTERVAL_MS, Math.ceil((resetAt - now) / remaining));
  }
}

/**
 * Waits for this provider's next available slot (up to maxWaitMs) and
 * reserves it. Returns false — without sleeping the full maxWaitMs — when a
 * slot will not open within the budget, so a caller can fail fast (e.g. as
 * PROVIDER_THROTTLED) rather than blocking a scan on our own pacing.
 */
export async function acquireSlot(providerId: string, maxWaitMs: number): Promise<boolean> {
  const s = getState(providerId);
  const now = Date.now();
  const waitMs = Math.max(0, s.nextAllowedAt - now);
  if (waitMs > maxWaitMs) return false;

  if (waitMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, waitMs));

  const acquiredAt = Math.max(Date.now(), s.nextAllowedAt);
  s.nextAllowedAt = acquiredAt + s.minIntervalMs;
  return true;
}

// Test-only: module state persists for the life of the Edge Function
// instance (exactly what production wants), so a test suite needs an
// explicit way to reset it between cases.
export function __resetForTests(): void {
  state.clear();
}
