// P3-33: single authoritative tier-configuration source for the Supabase
// runtime — tier ordering, scan/inventory entitlement limits, and the
// display metadata (label, monthly price) the frontend needs to render the
// subscription panel without maintaining its own competing copy.
//
// The *charged* amount for a paid tier always comes from Stripe via
// `stripePricing.ts`'s env-configured price IDs — TIER_PRICE_MONTHLY here is
// display copy only (what the UI shows before checkout) and must be kept in
// sync with the actual Stripe product/price config by whoever changes
// pricing. Annual pricing is intentionally not modeled here: the live
// product has no annual-billing UI (see CLAUDE.md/CURRENT_STATE.md), so
// there is no live display value to centralize yet.
//
// Values match CLAUDE.md's tier table and `packages/shared/src/constants/tiers.ts`.
// `null` = unlimited.

import { PAID_TIERS, type PaidTier } from "./stripePricing.ts";

export type Tier = "trial" | "scout" | "hustle" | "stack" | "empire";

export const TIER_ORDER: Tier[] = ["trial", "scout", "hustle", "stack", "empire"];

export { PAID_TIERS };
export type { PaidTier };

export const TIER_LABELS: Record<Tier, string> = {
  trial: "Trial",
  scout: "Scout",
  hustle: "Hustle",
  stack: "Stack",
  empire: "Empire",
};

export const TIER_PRICE_MONTHLY: Record<PaidTier, number> = {
  hustle: 19,
  stack: 49,
  empire: 199,
};

export const SCAN_LIMITS: Record<Tier, number | null> = {
  trial: null, scout: 25, hustle: 250, stack: null, empire: null,
};

export const ITEM_LIMITS: Record<Tier, number | null> = {
  trial: null, scout: 10, hustle: 250, stack: null, empire: null,
};

function isKnownTier(tier: string): tier is Tier {
  return (TIER_ORDER as string[]).includes(tier);
}

// Fail closed: an unrecognized tier value (corrupt data, typo, a tier
// retired in the future) gets the most restrictive known limits (scout's),
// never unlimited. A recognized tier's own `null` (= genuinely unlimited)
// is preserved unchanged.
export function resolveScanLimit(tier: string | null | undefined): number | null {
  return tier && isKnownTier(tier) ? SCAN_LIMITS[tier] : SCAN_LIMITS.scout;
}

export function resolveItemLimit(tier: string | null | undefined): number | null {
  return tier && isKnownTier(tier) ? ITEM_LIMITS[tier] : ITEM_LIMITS.scout;
}

// Display-only catalog for the frontend subscription panel — label, monthly
// price, and the same entitlement numbers enforced server-side, so
// `app.html` never hardcodes a competing figure (P3-33).
export function paidTierCatalog(): Record<PaidTier, {
  label: string; priceMonthly: number; scansPerMonth: number | null; inventoryItems: number | null;
}> {
  const out = {} as Record<PaidTier, {
    label: string; priceMonthly: number; scansPerMonth: number | null; inventoryItems: number | null;
  }>;
  for (const tier of PAID_TIERS) {
    out[tier] = {
      label: TIER_LABELS[tier],
      priceMonthly: TIER_PRICE_MONTHLY[tier],
      scansPerMonth: SCAN_LIMITS[tier],
      inventoryItems: ITEM_LIMITS[tier],
    };
  }
  return out;
}
