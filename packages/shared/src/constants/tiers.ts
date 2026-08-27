import type { UserTier } from "../types";

// P3-33: this module is not currently imported by any live runtime path
// (app.html has no build step and cannot import TS; the Supabase Edge
// Functions runtime's ability to safely consume packages/shared via a
// cross-package import is unverified — see P3-34/HANDOFF.md). The runtime
// source of truth for scan/inventory limits and Stripe-billed pricing is
// `supabase/functions/_shared/tierCatalog.ts` (limits) and
// `supabase/functions/_shared/stripePricing.ts` (price IDs) — kept in
// lockstep with this file by hand until that import path is proven safe.
// `scansPerMonth`/`inventoryItems`/`priceMonthly` below match those files.
// `priceYearly` does not: annual billing has no live UI (see
// CURRENT_STATE.md), so there is no live value to reconcile it against —
// do not treat it as authoritative until annual UI is approved and wired.
export interface TierConfig {
  tier: UserTier;
  label: string;
  priceMonthly: number;   // USD
  priceYearly: number;    // USD
  limits: {
    scansPerMonth: number | null;  // null = unlimited
    inventoryItems: number | null;
    activeListings: number | null;
  };
  features: string[];
}

export const TIER_CONFIGS: Record<UserTier, TierConfig> = {
  trial: {
    tier: "trial",
    label: "Trial",
    priceMonthly: 0,
    priceYearly: 0,
    limits: {
      scansPerMonth: null,
      inventoryItems: null,
      activeListings: 5,
    },
    features: [
      "Unlimited scans (7 days)",
      "Unlimited inventory (7 days)",
      "Basic profit calculator",
    ],
  },
  scout: {
    tier: "scout",
    label: "Scout",
    priceMonthly: 0,
    priceYearly: 0,
    limits: {
      scansPerMonth: 25,
      inventoryItems: 10,
      activeListings: 25,
    },
    features: [
      "25 scans/month",
      "10 inventory items",
      "Basic profit calculator",
    ],
  },
  hustle: {
    tier: "hustle",
    label: "Hustle",
    priceMonthly: 19,
    priceYearly: 190,
    limits: {
      scansPerMonth: 250,
      inventoryItems: 250,
      activeListings: 200,
    },
    features: [
      "250 scans/month",
      "250 inventory items",
      "P&L tracking",
      "CSV export",
      "Shelf scan",
    ],
  },
  stack: {
    tier: "stack",
    label: "Stack",
    priceMonthly: 49,
    priceYearly: 490,
    limits: {
      scansPerMonth: null,
      inventoryItems: null,
      activeListings: 1000,
    },
    features: [
      "Unlimited scans",
      "Unlimited inventory",
      "Trends & market data",
      "Bulk listing tools",
      "Growth agent",
      "Priority support",
    ],
  },
  empire: {
    tier: "empire",
    label: "Empire",
    priceMonthly: 199,
    priceYearly: 1990,
    limits: {
      scansPerMonth: null,
      inventoryItems: null,
      activeListings: null,
    },
    features: [
      "Unlimited scans",
      "Unlimited inventory",
      "AI-powered sourcing suggestions",
      "Advanced analytics",
      "API access",
      "Dedicated support",
    ],
  },
};

export const TIER_ORDER: UserTier[] = ["trial", "scout", "hustle", "stack", "empire"];
