// MarketplaceEconomicsEngine (task doc §13-14). Computes marketplace-specific
// net profit/ROI/max-buy-price by reusing the existing deterministic
// financial engine (financialEngine.ts calcProfit / maxBuyPrice.ts
// calcMaxBuyPrice) with a marketplace-specific total fee percentage in place
// of the eBay-only fee parameter — the underlying math (fees + packaging +
// shipping -> net -> ROI, $0-cost ROI stays null) is untouched and preserved
// exactly for eBay via the user's own configured Settings.ebayFee.
//
// No AI values enter this file. No decision-making here — see decisionEngine.ts.
import { calcProfit, type ProfitCalcResult } from "./financialEngine.ts"
import { calcMaxBuyPrice } from "./maxBuyPrice.ts"
import type { MarketplaceFeeProfile, MarketplaceId } from "./marketplaceTypes.ts"

// Approved defaults (see docs/files/DECISIONS.md) — a single maintainable
// configuration layer, isolated from the eBay-only Settings.ebayFee, which
// remains the sole authority for eBay's own fee calculation.
export const MARKETPLACE_FEE_PROFILES: Record<Exclude<MarketplaceId, 'ebay'>, MarketplaceFeeProfile> = {
  etsy:           { marketplace: 'etsy', totalFeePct: 9.5, sellerTypicallyPaysShipping: true },  // ~6.5% transaction + ~3% payment processing
  reverb:         { marketplace: 'reverb', totalFeePct: 8, sellerTypicallyPaysShipping: true },   // ~5% marketplace + ~3% payment processing
  discogs:        { marketplace: 'discogs', totalFeePct: 9, sellerTypicallyPaysShipping: true },
  amazon:         { marketplace: 'amazon', totalFeePct: 15, sellerTypicallyPaysShipping: true },
  mercari:        { marketplace: 'mercari', totalFeePct: 10, sellerTypicallyPaysShipping: true },
  poshmark:       { marketplace: 'poshmark', totalFeePct: 20, sellerTypicallyPaysShipping: true },
  facebook_local: { marketplace: 'facebook_local', totalFeePct: 0, sellerTypicallyPaysShipping: false }, // in-person, no platform fee, no shipping
}

export function totalFeePctFor(marketplace: MarketplaceId, ebayFeePct: number): number {
  if (marketplace === 'ebay') return ebayFeePct
  return MARKETPLACE_FEE_PROFILES[marketplace].totalFeePct
}

// facebook_local is always in-person — no seller-borne shipping cost either way.
export function shipCostFor(marketplace: MarketplaceId, configuredShipCost: number): number {
  if (marketplace === 'facebook_local') return 0
  return configuredShipCost
}

export interface MarketplaceProfitInput {
  marketplace: MarketplaceId
  expectedSalePrice: number
  cost: number
  pkgCost: number
  shipCost: number
  ebayFeePct: number
}

export function calcMarketplaceProfit(input: MarketplaceProfitInput): ProfitCalcResult {
  return calcProfit({
    sellPrice: input.expectedSalePrice,
    cost: input.cost,
    pkgCost: input.pkgCost,
    shipCost: input.shipCost,
    ebayFee: totalFeePctFor(input.marketplace, input.ebayFeePct),
  })
}

export interface MarketplaceMaxBuyInput {
  marketplace: MarketplaceId
  expectedSalePrice: number
  pkgCost: number
  shipCost: number
  minProfit: number
  targetRoi: number
  ebayFeePct: number
}

export function calcMarketplaceMaxBuyPrice(input: MarketplaceMaxBuyInput) {
  return calcMaxBuyPrice({
    sellPrice: input.expectedSalePrice,
    pkgCost: input.pkgCost,
    shipCost: input.shipCost,
    minProfit: input.minProfit,
    targetRoi: input.targetRoi,
    ebayFee: totalFeePctFor(input.marketplace, input.ebayFeePct),
  })
}
