// Runtime tests for the central Stripe pricing config (P1-B). Run: `deno test supabase/functions/_shared/`
// No live Stripe/Supabase — pure config resolution against Deno.env.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isPaidTier,
  normalizeInterval,
  priceEnvVarName,
  resolvePriceId,
  resolveTierFromPriceId,
} from "./stripePricing.ts";

function withEnv(vars: Record<string, string>, fn: () => void) {
  const prior: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) prior[k] = Deno.env.get(k);
  for (const [k, v] of Object.entries(vars)) Deno.env.set(k, v);
  try {
    fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (prior[k] === undefined) Deno.env.delete(k);
      else Deno.env.set(k, prior[k]!);
    }
  }
}

Deno.test("isPaidTier accepts only the three paid tiers", () => {
  assertEquals(isPaidTier("hustle"), true);
  assertEquals(isPaidTier("stack"), true);
  assertEquals(isPaidTier("empire"), true);
  assertEquals(isPaidTier("scout"), false);
  assertEquals(isPaidTier("trial"), false);
});

Deno.test("normalizeInterval maps Stripe-style and plain-English intervals", () => {
  assertEquals(normalizeInterval("year"), "annual");
  assertEquals(normalizeInterval("annual"), "annual");
  assertEquals(normalizeInterval("yearly"), "annual");
  assertEquals(normalizeInterval("month"), "monthly");
  assertEquals(normalizeInterval(undefined), "monthly");
  assertEquals(normalizeInterval(null), "monthly");
});

Deno.test("resolvePriceId reads the configured env var for tier+interval", () => {
  withEnv({ STRIPE_PRICE_HUSTLE_MONTHLY: "price_hustle_m" }, () => {
    assertEquals(resolvePriceId("hustle", "monthly"), "price_hustle_m");
  });
});

Deno.test("resolvePriceId returns null (never invented) when unconfigured", () => {
  withEnv({}, () => {
    Deno.env.delete("STRIPE_PRICE_EMPIRE_ANNUAL");
    assertEquals(resolvePriceId("empire", "annual"), null);
  });
});

Deno.test("priceEnvVarName names the exact missing secret for each tier/interval", () => {
  assertEquals(priceEnvVarName("stack", "annual"), "STRIPE_PRICE_STACK_ANNUAL");
  assertEquals(priceEnvVarName("empire", "monthly"), "STRIPE_PRICE_EMPIRE_MONTHLY");
});

Deno.test("resolveTierFromPriceId is the exact reverse of resolvePriceId — checkout and webhook can never diverge", () => {
  withEnv({
    STRIPE_PRICE_HUSTLE_MONTHLY: "price_h_m",
    STRIPE_PRICE_HUSTLE_ANNUAL: "price_h_a",
    STRIPE_PRICE_STACK_MONTHLY: "price_s_m",
  }, () => {
    assertEquals(resolveTierFromPriceId("price_h_m"), { tier: "hustle", interval: "monthly" });
    assertEquals(resolveTierFromPriceId("price_h_a"), { tier: "hustle", interval: "annual" });
    assertEquals(resolveTierFromPriceId("price_s_m"), { tier: "stack", interval: "monthly" });
  });
});

Deno.test("resolveTierFromPriceId fails closed on an unknown price id — never guesses a tier", () => {
  withEnv({ STRIPE_PRICE_HUSTLE_MONTHLY: "price_h_m" }, () => {
    assertEquals(resolveTierFromPriceId("price_totally_unknown"), null);
  });
});

Deno.test("resolveTierFromPriceId fails closed on null/undefined/empty price id", () => {
  assertEquals(resolveTierFromPriceId(null), null);
  assertEquals(resolveTierFromPriceId(undefined), null);
  assertEquals(resolveTierFromPriceId(""), null);
});

Deno.test("annual and monthly for the same tier resolve to the same tier, different interval only", () => {
  withEnv({
    STRIPE_PRICE_STACK_MONTHLY: "price_stack_m",
    STRIPE_PRICE_STACK_ANNUAL: "price_stack_a",
  }, () => {
    const monthly = resolveTierFromPriceId("price_stack_m");
    const annual = resolveTierFromPriceId("price_stack_a");
    assertEquals(monthly?.tier, annual?.tier);
    assertEquals(monthly?.interval !== annual?.interval, true);
  });
});
