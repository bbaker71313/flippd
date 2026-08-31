import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { acquireSlot, noteRateLimitHeaders, __resetForTests } from './providerRateLimit.ts';

Deno.test('acquireSlot: a fresh provider has its first slot available immediately', async () => {
  __resetForTests();
  const start = Date.now();
  const acquired = await acquireSlot('test-fresh', 5_000);
  assertEquals(acquired, true);
  assertEquals(Date.now() - start < 50, true, 'first acquisition must not wait');
});

Deno.test('acquireSlot: a second immediate call is paced by the conservative default', async () => {
  __resetForTests();
  await acquireSlot('test-paced', 5_000);
  const start = Date.now();
  const acquired = await acquireSlot('test-paced', 5_000);
  assertEquals(acquired, true);
  // Default pacing is 300ms — allow scheduler jitter on either side.
  assertEquals(Date.now() - start >= 250, true, 'second acquisition must be paced, not immediate');
});

Deno.test('acquireSlot: returns false without waiting when the budget is too small', async () => {
  __resetForTests();
  await acquireSlot('test-budget', 5_000);
  const start = Date.now();
  const acquired = await acquireSlot('test-budget', 10);
  assertEquals(acquired, false);
  assertEquals(Date.now() - start < 50, true, 'a refused acquisition must fail fast, not sleep the full pacing interval');
});

Deno.test('noteRateLimitHeaders: remaining=0 pushes the next slot out to the reset time', async () => {
  __resetForTests();
  const headers = new Headers({ 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': '3600' });
  noteRateLimitHeaders('test-exhausted', headers);
  const acquired = await acquireSlot('test-exhausted', 100);
  assertEquals(acquired, false, 'quota-exhausted headers must block acquisition well past a short budget');
});

Deno.test('noteRateLimitHeaders: absent headers are a no-op, not a throw', () => {
  __resetForTests();
  noteRateLimitHeaders('test-noop', new Headers());
  // No assertion beyond "did not throw" — the conservative default stays in
  // effect, which the other tests already cover.
});

Deno.test('noteRateLimitHeaders: healthy remaining budget paces within the reset window, never blocks it entirely', async () => {
  __resetForTests();
  // 5 requests remaining over the next 1000ms => ~200ms floor spacing, below
  // the 300ms conservative default, so the default should still win.
  const headers = new Headers({ 'X-RateLimit-Remaining': '5', 'X-RateLimit-Reset': '1' });
  noteRateLimitHeaders('test-healthy', headers);
  const acquired = await acquireSlot('test-healthy', 5_000);
  assertEquals(acquired, true);
});
