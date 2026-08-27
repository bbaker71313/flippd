// P1-B: single authoritative Stripe price configuration, used by both
// stripe-checkout (tier+interval -> price id) and stripe-webhook (price id ->
// tier+interval). Both directions are derived from the same env-var table so
// they can never diverge into separate hardcoded maps.
//
// Changing monthly <-> annual for a tier changes billing cadence only — it
// never changes the internal feature tier (approved product rule,
// DECISIONS.md). Price IDs always come from Supabase secrets; an unconfigured
// or unrecognized price id fails closed (no tier is invented or assigned).

export type PaidTier = 'hustle' | 'stack' | 'empire';
export type BillingInterval = 'monthly' | 'annual';

const TIER_INTERVAL_ENV: Record<PaidTier, Record<BillingInterval, string>> = {
  hustle: { monthly: 'STRIPE_PRICE_HUSTLE_MONTHLY', annual: 'STRIPE_PRICE_HUSTLE_ANNUAL' },
  stack:  { monthly: 'STRIPE_PRICE_STACK_MONTHLY',  annual: 'STRIPE_PRICE_STACK_ANNUAL' },
  empire: { monthly: 'STRIPE_PRICE_EMPIRE_MONTHLY', annual: 'STRIPE_PRICE_EMPIRE_ANNUAL' },
};

export const PAID_TIERS: PaidTier[] = ['hustle', 'stack', 'empire'];
const INTERVALS: BillingInterval[] = ['monthly', 'annual'];

export function isPaidTier(tier: string): tier is PaidTier {
  return (PAID_TIERS as string[]).includes(tier);
}

export function normalizeInterval(raw: string | undefined | null): BillingInterval {
  if (raw === 'year' || raw === 'annual' || raw === 'yearly') return 'annual';
  return 'monthly';
}

// The env var *name* to configure for a given tier/interval — used to report
// exactly what configuration is missing (P1-B: "surface that exact missing
// configuration", never invent a price id).
export function priceEnvVarName(tier: PaidTier, interval: BillingInterval): string {
  return TIER_INTERVAL_ENV[tier][interval];
}

export function resolvePriceId(tier: PaidTier, interval: BillingInterval): string | null {
  return Deno.env.get(priceEnvVarName(tier, interval)) ?? null;
}

// Reverse lookup for the webhook: which tier/interval does this Stripe price
// id correspond to, per the *currently configured* secrets. Unknown/removed
// price ids resolve to null — callers must fail closed (no tier assigned)
// rather than guess.
export function resolveTierFromPriceId(
  priceId: string | null | undefined,
): { tier: PaidTier; interval: BillingInterval } | null {
  if (!priceId) return null;
  for (const tier of PAID_TIERS) {
    for (const interval of INTERVALS) {
      if (resolvePriceId(tier, interval) === priceId) return { tier, interval };
    }
  }
  return null;
}
