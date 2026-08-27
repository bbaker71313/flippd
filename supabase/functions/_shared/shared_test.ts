// Runtime tests for shared Edge Function utils. Run: `deno test supabase/functions/_shared/`
// No live Supabase — pure crypto + constants.
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { b64url, signJWT, verifyJWT, getAuthedUserIdChecked } from "./jwt.ts";
import { SCAN_LIMITS, ITEM_LIMITS } from "./tierLimits.ts";

const SECRET = "test-secret-not-production";

Deno.test("signJWT → verifyJWT roundtrip preserves payload", async () => {
  const token = await signJWT({ sub: 42, username: "rita" }, SECRET);
  const payload = await verifyJWT(token, SECRET);
  assertEquals(payload.sub, 42);
  assertEquals(payload.username, "rita");
});

Deno.test("verifyJWT rejects wrong secret", async () => {
  const token = await signJWT({ sub: 1 }, SECRET);
  await assertRejects(() => verifyJWT(token, "different-secret"), Error, "Invalid signature");
});

Deno.test("verifyJWT rejects tampered payload", async () => {
  const token = await signJWT({ sub: 1 }, SECRET);
  const [h, _p, s] = token.split(".");
  const forged = `${h}.${b64url(JSON.stringify({ sub: 999, exp: 9999999999 }))}.${s}`;
  await assertRejects(() => verifyJWT(forged, SECRET), Error, "Invalid signature");
});

Deno.test("verifyJWT rejects expired token", async () => {
  const token = await signJWT({ sub: 1 }, SECRET, -10); // expired 10s ago
  await assertRejects(() => verifyJWT(token, SECRET), Error, "Token expired");
});

Deno.test("verifyJWT rejects malformed token", async () => {
  await assertRejects(() => verifyJWT("not.a.jwt.token", SECRET), Error, "Invalid token");
});

// P2-29
Deno.test("signJWT: default session lifetime is 30 days, aligned with auth/index.ts's cookie Max-Age (2592000s)", async () => {
  const before = Math.floor(Date.now() / 1000);
  const token = await signJWT({ sub: 1 }, SECRET);
  const payload = await verifyJWT(token, SECRET);
  const lifetimeSeconds = (payload.exp as number) - before;
  const THIRTY_DAYS = 30 * 24 * 60 * 60;
  // Allow a small margin for test execution time, but this must not be 90 days.
  assertEquals(Math.abs(lifetimeSeconds - THIRTY_DAYS) < 5, true);
});

Deno.test("signJWT: an explicit expiresInSeconds override (e.g. a password-reset or OAuth-state token) is unaffected by the session default", async () => {
  const before = Math.floor(Date.now() / 1000);
  const token = await signJWT({ sub: 1, purpose: "password_reset" }, SECRET, 3600);
  const payload = await verifyJWT(token, SECRET);
  const lifetimeSeconds = (payload.exp as number) - before;
  assertEquals(Math.abs(lifetimeSeconds - 3600) < 5, true);
});

// Minimal fake supabase whose users.token_version is `dbVersion`.
function fakeSupabase(dbVersion: number | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: dbVersion === null ? null : { token_version: dbVersion }, error: null }),
        }),
      }),
    }),
  };
}

Deno.test("getAuthedUserIdChecked accepts token with matching token_version (SEC-012)", async () => {
  const token = await signJWT({ sub: 7, token_version: 3 }, SECRET);
  const req = new Request("http://x", { headers: { Cookie: `sfp_auth=${encodeURIComponent(token)}` } });
  assertEquals(await getAuthedUserIdChecked(req, SECRET, fakeSupabase(3)), 7);
});

Deno.test("getAuthedUserIdChecked rejects stale token_version (revoked) (SEC-012)", async () => {
  const token = await signJWT({ sub: 7, token_version: 2 }, SECRET); // DB bumped to 3
  const req = new Request("http://x", { headers: { Cookie: `sfp_auth=${encodeURIComponent(token)}` } });
  assertEquals(await getAuthedUserIdChecked(req, SECRET, fakeSupabase(3)), null);
});

Deno.test("getAuthedUserIdChecked treats missing versions as 0 (legacy token, fresh user)", async () => {
  const token = await signJWT({ sub: 7 }, SECRET); // no token_version → 0
  const req = new Request("http://x", { headers: { Cookie: `sfp_auth=${encodeURIComponent(token)}` } });
  assertEquals(await getAuthedUserIdChecked(req, SECRET, fakeSupabase(0)), 7);
});

Deno.test("getAuthedUserIdChecked rejects when user row missing", async () => {
  const token = await signJWT({ sub: 7, token_version: 0 }, SECRET);
  const req = new Request("http://x", { headers: { Cookie: `sfp_auth=${encodeURIComponent(token)}` } });
  assertEquals(await getAuthedUserIdChecked(req, SECRET, fakeSupabase(null)), null);
});

Deno.test("tier limits match CLAUDE.md spec (single source of truth)", () => {
  assertEquals(SCAN_LIMITS, { trial: null, scout: 25, hustle: 250, stack: null, empire: null });
  assertEquals(ITEM_LIMITS, { trial: null, scout: 10, hustle: 250, stack: null, empire: null });
});
