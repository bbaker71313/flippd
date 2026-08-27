// P1-K workflow-level integration tests for the real production Stripe
// checkout handler (handleCheckoutRequest, extracted + made testable in
// P1-I). Exercises real auth (JWT cookie + fake users table), a mocked
// global fetch standing in for the Stripe Checkout/Portal APIs, and a fake
// supabase client — proving the actual wiring in stripe-checkout/index.ts,
// not just stripePricing.ts in isolation (already covered by
// stripePricing_test.ts).
//
// Run: `deno test supabase/functions/stripe-checkout/`
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { signJWT } from "../_shared/jwt.ts";
import { makeFakeSupabase } from "../_shared/testing/fakeSupabase.ts";
import { handleCheckoutRequest } from "./index.ts";

const JWT_SECRET = "test-secret-not-real";
const USER_ID = 7;

Deno.env.set("STRIPE_SECRET_KEY", "sk_test_fake");
Deno.env.set("JWT_SECRET", JWT_SECRET);
Deno.env.set("STRIPE_PRICE_HUSTLE_MONTHLY", "price_hustle_m");
Deno.env.set("STRIPE_PRICE_HUSTLE_ANNUAL", "price_hustle_a");
Deno.env.set("STRIPE_PRICE_STACK_MONTHLY", "price_stack_m");
Deno.env.delete("STRIPE_PRICE_STACK_ANNUAL"); // deliberately unconfigured for the fail-closed test

function makeCheckoutSupabase() {
  return makeFakeSupabase({
    users: [{ id: USER_ID, token_version: 0, stripe_customer_id: "cus_existing" }],
  });
}

async function authedRequest(path: string, body: Record<string, unknown>) {
  const token = await signJWT({ sub: USER_ID, token_version: 0 }, JWT_SECRET);
  return new Request(`https://x/stripe-checkout${path}`, {
    method: "POST",
    headers: { Cookie: `sfp_auth=${token}`, "x-sfp-client": "1", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockStripeFetch(sessionJson: Record<string, unknown>, status = 200) {
  const original = globalThis.fetch;
  const calls: string[] = [];
  const headerCalls: Headers[] = [];
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(String(init?.body ?? ""));
    headerCalls.push(new Headers(init?.headers));
    return Promise.resolve(new Response(JSON.stringify(sessionJson), { status }));
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; }, calls, headerCalls };
}

Deno.test("checkout: tier+interval resolve to the correct Stripe price id (monthly)", async () => {
  const supabase = makeCheckoutSupabase();
  const { restore, calls } = mockStripeFetch({ url: "https://checkout.stripe.com/x", id: "cs_1" });
  try {
    const req = await authedRequest("", { tier: "hustle", interval: "monthly" });
    const res = await handleCheckoutRequest(req, supabase as any);
    const body = await res.json();
    assertEquals(res.status, 200);
    assertEquals(body.url, "https://checkout.stripe.com/x");
    assertEquals(calls[0].includes(encodeURIComponent("price_hustle_m").replace(/%2C/g, ",")) || calls[0].includes("price_hustle_m"), true);
  } finally { restore(); }
});

Deno.test("checkout: tier+interval resolve to the correct Stripe price id (annual) — same tier, different price than monthly", async () => {
  const supabase = makeCheckoutSupabase();
  const { restore, calls } = mockStripeFetch({ url: "https://checkout.stripe.com/y", id: "cs_2" });
  try {
    const req = await authedRequest("", { tier: "hustle", interval: "annual" });
    await handleCheckoutRequest(req, supabase as any);
    assertEquals(calls[0].includes("price_hustle_a"), true);
    assertEquals(calls[0].includes("price_hustle_m"), false);
  } finally { restore(); }
});

Deno.test("checkout: unconfigured price id fails closed with the exact missing secret name, never invents a price", async () => {
  const supabase = makeCheckoutSupabase();
  const { restore, calls } = mockStripeFetch({}); // must never be reached
  try {
    const req = await authedRequest("", { tier: "stack", interval: "annual" });
    const res = await handleCheckoutRequest(req, supabase as any);
    const body = await res.json();
    assertEquals(res.status, 503);
    assertEquals(body.error, "Price ID not configured for stack (annual) — set STRIPE_PRICE_STACK_ANNUAL");
    assertEquals(calls.length, 0); // never called Stripe with a guessed/missing price
  } finally { restore(); }
});

Deno.test("checkout: server sets client_reference_id from the authenticated user, ignoring any client-supplied identity", async () => {
  const supabase = makeCheckoutSupabase();
  const { restore, calls } = mockStripeFetch({ url: "https://checkout.stripe.com/z", id: "cs_3" });
  try {
    // Attacker-style payload trying to smuggle a different user id in the body.
    const req = await authedRequest("", { tier: "hustle", interval: "monthly", userId: 999, client_reference_id: 999 });
    await handleCheckoutRequest(req, supabase as any);
    assertEquals(calls[0].includes(`client_reference_id=${USER_ID}`), true);
    assertEquals(calls[0].includes("client_reference_id=999"), false);
  } finally { restore(); }
});

Deno.test("checkout: unauthenticated request is rejected before any Stripe call", async () => {
  const supabase = makeCheckoutSupabase();
  const { restore, calls } = mockStripeFetch({});
  try {
    const req = new Request("https://x/stripe-checkout", {
      method: "POST",
      headers: { "x-sfp-client": "1", "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "hustle" }),
    });
    const res = await handleCheckoutRequest(req, supabase as any);
    assertEquals(res.status, 401);
    assertEquals(calls.length, 0);
  } finally { restore(); }
});

Deno.test("checkout: missing CSRF header is rejected before auth or any Stripe call", async () => {
  const supabase = makeCheckoutSupabase();
  const { restore, calls } = mockStripeFetch({});
  try {
    const req = new Request("https://x/stripe-checkout", { method: "POST", body: JSON.stringify({ tier: "hustle" }) });
    const res = await handleCheckoutRequest(req, supabase as any);
    assertEquals(res.status, 403);
    assertEquals(calls.length, 0);
  } finally { restore(); }
});

Deno.test("checkout: sends a Stripe Idempotency-Key header, stable across a retry of the same attempt", async () => {
  const supabase = makeCheckoutSupabase();
  const { restore, headerCalls } = mockStripeFetch({ url: "https://checkout.stripe.com/x", id: "cs_1" });
  try {
    const req1 = await authedRequest("", { tier: "hustle", interval: "monthly", attemptId: "click_1" });
    await handleCheckoutRequest(req1, supabase as any);
    const req2 = await authedRequest("", { tier: "hustle", interval: "monthly", attemptId: "click_1" });
    await handleCheckoutRequest(req2, supabase as any);

    const key1 = headerCalls[0].get("Idempotency-Key");
    const key2 = headerCalls[1].get("Idempotency-Key");
    if (!key1) throw new Error("expected an Idempotency-Key header on the Stripe checkout request");
    assertEquals(key1, key2, "retrying the same attemptId must reuse the same Idempotency-Key");
  } finally { restore(); }
});

Deno.test("checkout: a different tier produces a different Idempotency-Key even with the same attemptId", async () => {
  const supabase = makeCheckoutSupabase();
  const { restore, headerCalls } = mockStripeFetch({ url: "https://checkout.stripe.com/x", id: "cs_1" });
  try {
    const req1 = await authedRequest("", { tier: "hustle", interval: "monthly", attemptId: "click_1" });
    await handleCheckoutRequest(req1, supabase as any);
    const req2 = await authedRequest("", { tier: "stack", interval: "monthly", attemptId: "click_1" });
    await handleCheckoutRequest(req2, supabase as any);

    const key1 = headerCalls[0].get("Idempotency-Key");
    const key2 = headerCalls[1].get("Idempotency-Key");
    assertEquals(key1 !== key2, true, "changing tier must change the logical checkout operation");
  } finally { restore(); }
});

Deno.test("portal: uses the authenticated user's own stripe_customer_id, not a client-supplied one", async () => {
  const supabase = makeCheckoutSupabase();
  const { restore, calls } = mockStripeFetch({ url: "https://billing.stripe.com/p/1" });
  try {
    const req = await authedRequest("/portal", { stripe_customer_id: "cus_attacker_supplied" });
    const res = await handleCheckoutRequest(req, supabase as any);
    assertEquals(res.status, 200);
    assertEquals(calls[0].includes("cus_existing"), true);
    assertEquals(calls[0].includes("cus_attacker_supplied"), false);
  } finally { restore(); }
});
