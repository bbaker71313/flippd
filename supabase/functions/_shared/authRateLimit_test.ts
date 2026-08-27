import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { clientIp, rateLimitBucket, inMemoryRateLimitOk, _resetInMemoryRateLimitFallback } from './authRateLimit.ts';

function reqWithHeader(headers: Record<string, string>): Request {
  return new Request('https://x/auth/login', { headers });
}

Deno.test('clientIp: trusts the LAST X-Forwarded-For entry, not the client-forgeable first one', () => {
  // A client sending its own spoofed header, with the trusted gateway's
  // observed IP appended as the last entry.
  const req = reqWithHeader({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' });
  assertEquals(clientIp(req), '203.0.113.9');
});

Deno.test('clientIp: a single-entry header (the common case) is used as-is', () => {
  const req = reqWithHeader({ 'x-forwarded-for': '203.0.113.9' });
  assertEquals(clientIp(req), '203.0.113.9');
});

Deno.test('clientIp: no header at all returns null, not the string "unknown"', () => {
  const req = new Request('https://x/auth/login');
  assertEquals(clientIp(req), null);
});

Deno.test('rateLimitBucket: two requests with no identifiable IP never collide into one shared bucket', () => {
  const req1 = new Request('https://x/auth/login');
  const req2 = new Request('https://x/auth/login');
  const bucket1 = rateLimitBucket('login', req1);
  const bucket2 = rateLimitBucket('login', req2);
  assertNotEquals(bucket1, bucket2);
});

Deno.test('rateLimitBucket: two requests with the same identifiable IP share the same bucket', () => {
  const req1 = reqWithHeader({ 'x-forwarded-for': '203.0.113.9' });
  const req2 = reqWithHeader({ 'x-forwarded-for': '203.0.113.9' });
  assertEquals(rateLimitBucket('login', req1), rateLimitBucket('login', req2));
});

Deno.test('rateLimitBucket: different prefixes for the same IP produce different buckets (per-endpoint limits)', () => {
  const req = reqWithHeader({ 'x-forwarded-for': '203.0.113.9' });
  assertNotEquals(rateLimitBucket('login', req), rateLimitBucket('register', req));
});

Deno.test('inMemoryRateLimitOk: allows up to max attempts within the window, rejects the next', () => {
  _resetInMemoryRateLimitFallback();
  const bucket = 'test:fallback:1';
  const now = 1000;
  assertEquals(inMemoryRateLimitOk(bucket, 3, 60, now), true);
  assertEquals(inMemoryRateLimitOk(bucket, 3, 60, now + 1), true);
  assertEquals(inMemoryRateLimitOk(bucket, 3, 60, now + 2), true);
  assertEquals(inMemoryRateLimitOk(bucket, 3, 60, now + 3), false);
});

Deno.test('inMemoryRateLimitOk: resets after the window elapses', () => {
  _resetInMemoryRateLimitFallback();
  const bucket = 'test:fallback:2';
  const now = 1000;
  assertEquals(inMemoryRateLimitOk(bucket, 1, 60, now), true);
  assertEquals(inMemoryRateLimitOk(bucket, 1, 60, now + 1000), false); // still in window
  assertEquals(inMemoryRateLimitOk(bucket, 1, 60, now + 61_000), true); // window elapsed
});

Deno.test('inMemoryRateLimitOk: distinct buckets do not share state', () => {
  _resetInMemoryRateLimitFallback();
  const now = 1000;
  assertEquals(inMemoryRateLimitOk('a', 1, 60, now), true);
  assertEquals(inMemoryRateLimitOk('b', 1, 60, now), true); // not exhausted by bucket 'a'
});
