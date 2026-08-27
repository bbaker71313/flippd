import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { deriveCheckoutIdempotencyKey, sanitizeAttemptId } from './stripeIdempotency.ts';

Deno.test('deriveCheckoutIdempotencyKey: same user+tier+interval+attemptId reuses the same key (retry safety)', async () => {
  const input = { userId: 'user_1', tier: 'hustle', interval: 'monthly', attemptId: 'click_abc' };
  const a = await deriveCheckoutIdempotencyKey(input);
  const b = await deriveCheckoutIdempotencyKey(input);
  assertEquals(a, b);
});

Deno.test('deriveCheckoutIdempotencyKey: a different tier produces a different key', async () => {
  const a = await deriveCheckoutIdempotencyKey({ userId: 'user_1', tier: 'hustle', interval: 'monthly', attemptId: 'click_abc' });
  const b = await deriveCheckoutIdempotencyKey({ userId: 'user_1', tier: 'stack', interval: 'monthly', attemptId: 'click_abc' });
  assertNotEquals(a, b);
});

Deno.test('deriveCheckoutIdempotencyKey: a different interval produces a different key', async () => {
  const a = await deriveCheckoutIdempotencyKey({ userId: 'user_1', tier: 'hustle', interval: 'monthly', attemptId: 'click_abc' });
  const b = await deriveCheckoutIdempotencyKey({ userId: 'user_1', tier: 'hustle', interval: 'annual', attemptId: 'click_abc' });
  assertNotEquals(a, b);
});

Deno.test('deriveCheckoutIdempotencyKey: a different user produces a different key even with the same tier/interval/attemptId — no cross-user collision', async () => {
  const a = await deriveCheckoutIdempotencyKey({ userId: 'user_1', tier: 'hustle', interval: 'monthly', attemptId: 'click_abc' });
  const b = await deriveCheckoutIdempotencyKey({ userId: 'user_2', tier: 'hustle', interval: 'monthly', attemptId: 'click_abc' });
  assertNotEquals(a, b);
});

Deno.test('deriveCheckoutIdempotencyKey: a new deliberate attempt (different attemptId) gets a new key', async () => {
  const a = await deriveCheckoutIdempotencyKey({ userId: 'user_1', tier: 'hustle', interval: 'monthly', attemptId: 'click_1' });
  const b = await deriveCheckoutIdempotencyKey({ userId: 'user_1', tier: 'hustle', interval: 'monthly', attemptId: 'click_2' });
  assertNotEquals(a, b);
});

Deno.test('sanitizeAttemptId: missing/invalid attemptId falls back to a fresh random value each call (never a shared constant)', () => {
  const a = sanitizeAttemptId(undefined);
  const b = sanitizeAttemptId(undefined);
  assertNotEquals(a, b);
  assertNotEquals(sanitizeAttemptId(123), sanitizeAttemptId(123));
  assertNotEquals(sanitizeAttemptId('x'.repeat(500)), sanitizeAttemptId('x'.repeat(500)));
});

Deno.test('sanitizeAttemptId: a well-formed client attemptId is passed through unchanged', () => {
  assertEquals(sanitizeAttemptId('click_abc'), 'click_abc');
});
