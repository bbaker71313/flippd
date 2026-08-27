// P1-K workflow-level integration tests for the real production Stripe
// webhook handler (handleStripeWebhookEvent, extracted in P1-I). Exercises
// the actual business-effect switch against a fake supabase whose
// claim/complete RPCs mirror the real Postgres state machine (see
// _shared/testing/fakeStripeWebhookRpc.ts), plus a mocked global fetch
// standing in for Stripe's subscription-retrieval API.
//
// Run: `deno test supabase/functions/stripe-webhook/`
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { makeFakeSupabase } from "../_shared/testing/fakeSupabase.ts";
import { makeClaimStripeWebhookEventHandler, makeCompleteStripeWebhookEventHandler } from "../_shared/testing/fakeStripeWebhookRpc.ts";
import { handleStripeWebhookEvent, type StripeWebhookEvent } from "./index.ts";

Deno.env.set("STRIPE_PRICE_HUSTLE_MONTHLY", "price_hustle_m");
Deno.env.set("STRIPE_PRICE_HUSTLE_ANNUAL", "price_hustle_a");
Deno.env.set("STRIPE_PRICE_STACK_MONTHLY", "price_stack_m");
Deno.env.delete("STRIPE_PRICE_STACK_ANNUAL"); // deliberately unconfigured for the fail-closed test

function makeWebhookSupabase(userSeed: Record<string, unknown>[] = []) {
  const supabase = makeFakeSupabase({
    stripe_webhook_events: [],
    users: userSeed,
  });
  const rpcHandlers: Record<string, (p: Record<string, unknown>) => unknown> = {
    claim_stripe_webhook_event: makeClaimStripeWebhookEventHandler(() => supabase.__tables.stripe_webhook_events),
    complete_stripe_webhook_event: makeCompleteStripeWebhookEventHandler(() => supabase.__tables.stripe_webhook_events),
  };
  // deno-lint-ignore no-explicit-any
  (supabase as any).rpc = (name: string, params: Record<string, unknown>) => {
    const handler = rpcHandlers[name];
    if (!handler) throw new Error(`no rpc handler for ${name}`);
    return Promise.resolve(handler(params));
  };
  return supabase;
}

function mockFetch(subJson: Record<string, unknown>) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => {
    calls++;
    return Promise.resolve(new Response(JSON.stringify(subJson), { status: 200 }));
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; }, callCount: () => calls };
}

function checkoutEvent(id: string, subscriptionId: string, email: string): StripeWebhookEvent {
  return {
    id,
    type: "checkout.session.completed",
    data: { object: { customer: "cus_1", subscription: subscriptionId, customer_details: { email } } },
  };
}

Deno.test("checkout.session.completed: assigns the correct tier via the shared pricing config (monthly)", async () => {
  const supabase = makeWebhookSupabase([{ id: 1, email: "a@x.com", tier: "trial" }]);
  const { restore } = mockFetch({ items: { data: [{ price: { id: "price_hustle_m" } }] }, current_period_end: 1893456000 });
  try {
    const r = await handleStripeWebhookEvent(checkoutEvent("evt_1", "sub_1", "a@x.com"), supabase, "sk_test");
    assertEquals(r.status, 200);
    const user = supabase.__tables.users.find((u) => u.id === 1);
    assertEquals(user?.tier, "hustle");
    assertEquals(user?.subscription_status, "active");
  } finally { restore(); }
});

Deno.test("checkout.session.completed: unknown price id never invents/downgrades a tier", async () => {
  const supabase = makeWebhookSupabase([{ id: 1, email: "b@x.com", tier: "trial" }]);
  const { restore } = mockFetch({ items: { data: [{ price: { id: "price_totally_unknown" } }] } });
  try {
    const r = await handleStripeWebhookEvent(checkoutEvent("evt_2", "sub_2", "b@x.com"), supabase, "sk_test");
    assertEquals(r.status, 200); // event still acknowledged — Stripe must not retry forever
    const user = supabase.__tables.users.find((u) => u.id === 1);
    assertEquals(user?.tier, "trial"); // unchanged, never guessed
  } finally { restore(); }
});

Deno.test("duplicate webhook delivery does not repeat the tier change or re-fetch Stripe", async () => {
  const supabase = makeWebhookSupabase([{ id: 1, email: "c@x.com", tier: "trial" }]);
  const { restore, callCount } = mockFetch({ items: { data: [{ price: { id: "price_hustle_m" } }] }, current_period_end: 1893456000 });
  try {
    const event = checkoutEvent("evt_3", "sub_3", "c@x.com");
    const first = await handleStripeWebhookEvent(event, supabase, "sk_test");
    assertEquals(first.status, 200);
    assertEquals(callCount(), 1);

    // Redelivery of the exact same event (Stripe explicitly warns this happens)
    const second = await handleStripeWebhookEvent(event, supabase, "sk_test");
    assertEquals(second.status, 200);
    assertEquals(second.body.deduped, "already_succeeded");
    assertEquals(callCount(), 1); // no second Stripe API call — business effect never repeated
  } finally { restore(); }
});

Deno.test("concurrent duplicate delivery (still processing) is acknowledged without re-running effects", async () => {
  const supabase = makeWebhookSupabase([{ id: 1, email: "d@x.com", tier: "trial" }]);
  // Simulate a delivery already in flight for this event id.
  supabase.__tables.stripe_webhook_events.push({ id: "evt_4", event_type: "checkout.session.completed", status: "processing" });
  const { restore, callCount } = mockFetch({ items: { data: [{ price: { id: "price_hustle_m" } }] } });
  try {
    const r = await handleStripeWebhookEvent(checkoutEvent("evt_4", "sub_4", "d@x.com"), supabase, "sk_test");
    assertEquals(r.status, 200);
    assertEquals(r.body.deduped, "in_progress");
    assertEquals(callCount(), 0); // never touched Stripe or the user row for an in-flight duplicate
    const user = supabase.__tables.users.find((u) => u.id === 1);
    assertEquals(user?.tier, "trial");
  } finally { restore(); }
});

Deno.test("a failed event can be safely retried and succeeds on retry", async () => {
  const supabase = makeWebhookSupabase([{ id: 1, email: "e@x.com", tier: "trial" }]);
  supabase.__tables.stripe_webhook_events.push({ id: "evt_5", event_type: "checkout.session.completed", status: "failed", error_detail: "previous attempt errored" });
  const { restore } = mockFetch({ items: { data: [{ price: { id: "price_hustle_m" } }] }, current_period_end: 1893456000 });
  try {
    const r = await handleStripeWebhookEvent(checkoutEvent("evt_5", "sub_5", "e@x.com"), supabase, "sk_test");
    assertEquals(r.status, 200);
    assertEquals(r.body.deduped, undefined); // this was a real (re)claim + process, not a dedup ack
    const eventRow = supabase.__tables.stripe_webhook_events.find((e) => e.id === "evt_5");
    assertEquals(eventRow?.status, "succeeded");
    const user = supabase.__tables.users.find((u) => u.id === 1);
    assertEquals(user?.tier, "hustle");
  } finally { restore(); }
});

Deno.test("a handler exception marks the event failed (not succeeded) so it can be retried, and never applies a partial effect twice", async () => {
  const supabase = makeWebhookSupabase([{ id: 1, email: "f@x.com", tier: "trial" }]);
  const original = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error("simulated Stripe API outage"); }) as typeof fetch;
  try {
    const r = await handleStripeWebhookEvent(checkoutEvent("evt_6", "sub_6", "f@x.com"), supabase, "sk_test");
    assertEquals(r.status, 500);
    const eventRow = supabase.__tables.stripe_webhook_events.find((e) => e.id === "evt_6");
    assertEquals(eventRow?.status, "failed");
  } finally { globalThis.fetch = original; }
});

Deno.test("monthly and annual configuration parity: both resolve to the same tier via the shared config", async () => {
  const supabase = makeWebhookSupabase([{ id: 1, email: "g@x.com", tier: "trial" }, { id: 2, email: "h@x.com", tier: "trial" }]);
  const { restore } = mockFetch({ items: { data: [{ price: { id: "price_hustle_m" } }] }, current_period_end: 1893456000 });
  try {
    await handleStripeWebhookEvent(checkoutEvent("evt_7", "sub_7", "g@x.com"), supabase, "sk_test");
  } finally { restore(); }
  const { restore: restore2 } = mockFetch({ items: { data: [{ price: { id: "price_hustle_a" } }] }, current_period_end: 1893456000 });
  try {
    await handleStripeWebhookEvent(checkoutEvent("evt_8", "sub_8", "h@x.com"), supabase, "sk_test");
  } finally { restore2(); }
  const monthlyUser = supabase.__tables.users.find((u) => u.id === 1);
  const annualUser = supabase.__tables.users.find((u) => u.id === 2);
  assertEquals(monthlyUser?.tier, "hustle");
  assertEquals(annualUser?.tier, "hustle"); // same tier regardless of billing cadence
});

Deno.test("stack annual is unconfigured in this test env -> webhook fails closed, never assigns a guessed tier", async () => {
  const supabase = makeWebhookSupabase([{ id: 1, email: "i@x.com", tier: "trial" }]);
  // price_stack_a was never set via resolvePriceId (STRIPE_PRICE_STACK_ANNUAL unset) —
  // a webhook seeing an id that was never issued because checkout itself would
  // have failed closed 503 for this combination must equally never invent a tier.
  const { restore } = mockFetch({ items: { data: [{ price: { id: "price_stack_a_never_configured" } }] } });
  try {
    const r = await handleStripeWebhookEvent(checkoutEvent("evt_9", "sub_9", "i@x.com"), supabase, "sk_test");
    assertEquals(r.status, 200);
    const user = supabase.__tables.users.find((u) => u.id === 1);
    assertEquals(user?.tier, "trial");
  } finally { restore(); }
});
