import type { UserTier } from "../types";

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
      scansPerMonth: 10,
      inventoryItems: 20,
      activeListings: 5,
    },
    features: [
      "10 scans",
      "20 inventory items",
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
      inventoryItems: 100,
      activeListings: 25,
    },
    features: [
      "25 scans/month",
      "100 inventory items",
      "Basic profit calculator",
    ],
  },
  hustle: {
    tier: "hustle",
    label: "Hustle",
    priceMonthly: 19,
    priceYearly: 190,
    limits: {
      scansPerMonth: 300,
      inventoryItems: 1000,
      activeListings: 200,
    },
    features: [
      "300 scans/month",
      "1,000 inventory items",
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
      scansPerMonth: 1000,
      inventoryItems: 5000,
      activeListings: 1000,
    },
    features: [
      "1,000 scans/month",
      "5,000 inventory items",
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
