// P2-25 tests for getValidEbayToken()'s single-flight refresh logic.
//
// The actual distributed-lock guarantee lives in Postgres (row lock via
// SELECT ... FOR UPDATE inside ebay_claim_token_refresh — see migration
// 20260827132500_p2_ebay_token_refresh_single_flight.sql), which this
// sandbox has no live database to exercise. What's tested here is that the
// edge-function-side logic correctly drives that state machine — reusing an
// already-fresh token, waiting and re-reading when another caller holds the
// claim, performing exactly one refresh when it holds the claim, and always
// releasing the claim (success or failure) — against a fake `rpc()` that
// mirrors the migration's exact claim/complete semantics (including the
// stale-claim TTL) over an in-memory row, single-threaded like a real
// Postgres transaction serializes concurrent callers on the same row.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { getValidEbayToken } from './ebayClient.ts';

interface FakeRow {
  access_token: string;
  refresh_token: string;
  expires_at: string | null;
  refresh_claimed_at: string | null;
}

function makeFakeEbaySupabase(initial: FakeRow, claimTtlMs = 30_000) {
  const row: FakeRow = { ...initial };
  let refreshCalls = 0;

  return {
    row,
    get refreshCalls() { return refreshCalls; },
    // deno-lint-ignore no-explicit-any
    rpc(name: string, params: Record<string, any>) {
      if (name === 'ebay_get_tokens') {
        return Promise.resolve({ data: [{ access_token: row.access_token, refresh_token: row.refresh_token, expires_at: row.expires_at }], error: null });
      }
      if (name === 'ebay_claim_token_refresh') {
        const now = Date.now();
        if (row.expires_at && new Date(row.expires_at).getTime() > now + 60_000) {
          return Promise.resolve({ data: [{ claimed: false, access_token: row.access_token, expires_at: row.expires_at }], error: null });
        }
        if (row.refresh_claimed_at && new Date(row.refresh_claimed_at).getTime() > now - claimTtlMs) {
          return Promise.resolve({ data: [{ claimed: false, access_token: null, expires_at: row.expires_at }], error: null });
        }
        row.refresh_claimed_at = new Date(now).toISOString();
        return Promise.resolve({ data: [{ claimed: true, access_token: row.access_token, expires_at: row.expires_at }], error: null });
      }
      if (name === 'ebay_complete_token_refresh') {
        if (params.p_success) {
          row.access_token = params.p_access;
          row.expires_at = params.p_expires;
        }
        row.refresh_claimed_at = null;
        refreshCalls++; // counts *completed* refresh attempts (success or failure), not provider calls directly
        return Promise.resolve({ data: null, error: null });
      }
      throw new Error(`unexpected rpc: ${name}`);
    },
  };
}

function withEnv<T>(vars: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const prior: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) { prior[k] = Deno.env.get(k); Deno.env.set(k, vars[k]); }
  return fn().finally(() => {
    for (const k of Object.keys(vars)) { if (prior[k] === undefined) Deno.env.delete(k); else Deno.env.set(k, prior[k]!); }
  });
}

const CREDS = { EBAY_CLIENT_ID: 'id', EBAY_CLIENT_SECRET: 'secret' };
const originalFetch = globalThis.fetch;

Deno.test('getValidEbayToken: an already-fresh token is returned with no refresh call at all', async () => {
  let providerCalls = 0;
  globalThis.fetch = (() => { providerCalls++; return Promise.reject(new Error('should not be called')); }) as typeof fetch;
  try {
    const fake = makeFakeEbaySupabase({
      access_token: 'fresh_token', refresh_token: 'r', expires_at: new Date(Date.now() + 3_600_000).toISOString(), refresh_claimed_at: null,
    });
    const token = await withEnv(CREDS, () => getValidEbayToken(1, fake));
    assertEquals(token, 'fresh_token');
    assertEquals(providerCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

Deno.test('getValidEbayToken: an expired token triggers exactly one provider refresh call', async () => {
  let providerCalls = 0;
  globalThis.fetch = (() => {
    providerCalls++;
    return Promise.resolve(new Response(JSON.stringify({ access_token: 'new_token', expires_in: 7200 }), { status: 200 }));
  }) as typeof fetch;
  try {
    const fake = makeFakeEbaySupabase({
      access_token: 'old_token', refresh_token: 'r', expires_at: new Date(Date.now() - 1000).toISOString(), refresh_claimed_at: null,
    });
    const token = await withEnv(CREDS, () => getValidEbayToken(1, fake));
    assertEquals(token, 'new_token');
    assertEquals(providerCalls, 1);
    assertEquals(fake.row.refresh_claimed_at, null); // claim released
  } finally { globalThis.fetch = originalFetch; }
});

Deno.test('getValidEbayToken: two concurrent callers for the same user only make one provider refresh call, and the second reuses the refreshed token', async () => {
  let providerCalls = 0;
  let resolveProvider: (() => void) | null = null;
  const gate = new Promise<void>((resolve) => { resolveProvider = resolve; });
  globalThis.fetch = (async () => {
    providerCalls++;
    await gate; // hold the "network call" open until the test releases it, to force real overlap
    return new Response(JSON.stringify({ access_token: 'refreshed_once', expires_in: 7200 }), { status: 200 });
  }) as typeof fetch;
  try {
    const fake = makeFakeEbaySupabase({
      access_token: 'old_token', refresh_token: 'r', expires_at: new Date(Date.now() - 1000).toISOString(), refresh_claimed_at: null,
    });
    const callA = withEnv(CREDS, () => getValidEbayToken(1, fake));
    // Let caller A's synchronous-until-fetch logic run and claim before B starts.
    await new Promise((r) => setTimeout(r, 10));
    const callB = withEnv(CREDS, () => getValidEbayToken(1, fake));

    // Caller B is now waiting on the live claim; release the provider call so A can finish.
    await new Promise((r) => setTimeout(r, 10));
    resolveProvider!();

    const [tokenA, tokenB] = await Promise.all([callA, callB]);
    assertEquals(providerCalls, 1, 'only one caller should ever call eBay\'s token endpoint');
    assertEquals(tokenA, 'refreshed_once');
    assertEquals(tokenB, 'refreshed_once');
  } finally { globalThis.fetch = originalFetch; }
});

Deno.test('getValidEbayToken: a refresh failure releases the claim (recoverable, not deadlocked) and returns null', async () => {
  globalThis.fetch = (() => Promise.resolve(new Response('', { status: 401 }))) as typeof fetch;
  try {
    const fake = makeFakeEbaySupabase({
      access_token: 'old_token', refresh_token: 'r', expires_at: new Date(Date.now() - 1000).toISOString(), refresh_claimed_at: null,
    });
    const token = await withEnv(CREDS, () => getValidEbayToken(1, fake));
    assertEquals(token, null);
    assertEquals(fake.row.refresh_claimed_at, null); // released, not stuck
    assertEquals(fake.row.access_token, 'old_token'); // unchanged on failure

    // A subsequent call must be able to claim and try again (not permanently locked out).
    globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({ access_token: 'recovered', expires_in: 7200 }), { status: 200 }))) as typeof fetch;
    const retryToken = await withEnv(CREDS, () => getValidEbayToken(1, fake));
    assertEquals(retryToken, 'recovered');
  } finally { globalThis.fetch = originalFetch; }
});

Deno.test('getValidEbayToken: a stale (expired-TTL) claim is recoverable — a new caller reclaims and refreshes instead of waiting forever', async () => {
  let providerCalls = 0;
  globalThis.fetch = (() => {
    providerCalls++;
    return Promise.resolve(new Response(JSON.stringify({ access_token: 'recovered_after_stale_claim', expires_in: 7200 }), { status: 200 }));
  }) as typeof fetch;
  try {
    const fake = makeFakeEbaySupabase({
      access_token: 'old_token', refresh_token: 'r',
      expires_at: new Date(Date.now() - 1000).toISOString(),
      // Simulates a crashed refresh: claimed long enough ago that the TTL has elapsed.
      refresh_claimed_at: new Date(Date.now() - 60_000).toISOString(),
    }, /* claimTtlMs */ 30_000);
    const token = await withEnv(CREDS, () => getValidEbayToken(1, fake));
    assertEquals(token, 'recovered_after_stale_claim');
    assertEquals(providerCalls, 1);
  } finally { globalThis.fetch = originalFetch; }
});
