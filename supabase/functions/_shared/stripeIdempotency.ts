// P2-26: idempotency key for Stripe Checkout Session creation.
//
// Scoped to one *logical* checkout attempt: retrying the same click (same
// server-derived user + tier + interval + client attemptId) must reuse the
// same Stripe operation, but changing tier, changing interval, or a later
// deliberate new attempt (a fresh attemptId) must get a new Stripe operation.
// userId always comes from the caller's verified JWT, never from the request
// body — a client cannot forge this key to collide with another user's.

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface CheckoutIdempotencyInput {
  userId: string;
  tier: string;
  interval: string;
  /**
   * Client-supplied opaque token identifying "this one checkout click" —
   * e.g. generated once when the upgrade button is pressed and held in
   * sessionStorage for the duration of that flow. Absent/invalid input
   * falls back to a fresh random value, meaning that request is treated as
   * its own new logical attempt (no retry-dedup) rather than colliding with
   * anyone else's key.
   */
  attemptId?: string | null;
}

const MAX_ATTEMPT_ID_LEN = 128;

export function sanitizeAttemptId(raw: unknown): string {
  if (typeof raw === 'string' && raw.length > 0 && raw.length <= MAX_ATTEMPT_ID_LEN) return raw;
  return crypto.randomUUID();
}

export async function deriveCheckoutIdempotencyKey(input: CheckoutIdempotencyInput): Promise<string> {
  const attemptId = sanitizeAttemptId(input.attemptId);
  const canonical = `checkout:v1:${input.userId}:${input.tier}:${input.interval}:${attemptId}`;
  return `sfp_checkout_${await sha256Hex(canonical)}`;
}
