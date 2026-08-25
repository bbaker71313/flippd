// Deno-native mirror of packages/shared/src/utils/calcProfit.ts.
//
// Duplicated intentionally, not accidentally: Supabase Edge Functions run on
// Deno and this repo has not yet verified that a relative cross-package
// import (supabase/functions/... -> packages/shared/...) survives the
// Supabase CLI's bundler in production (see docs/CURRENT_STATE.md "Known
// issues" — claude-proxy inline calcProfit duplicates packages/shared).
// Until that is verified, this file is the single authoritative financial
// calculation for every Edge Function code path, and packages/shared/...
// is the authoritative version for the rest of the monorepo (web, tests).
// Keep the two in lockstep — same inputs, same outputs, same rounding.
//
// No AI values, no user-settings lookups, no external calls, no
// decision-making, no sourcing-style multiplier.

export interface CalcProfitInput {
  sellPrice: number
  cost: number
  pkgCost: number
  shipCost: number
  ebayFee: number
}

export interface ProfitCalcResult {
  gross: number
  ebayFees: number
  pkgCost: number
  shipCost: number
  totalFees: number
  net: number
  roi: number | null   // null when cost <= 0 — never fabricate a 0% return
  margin: number
}

export function calcProfit(input: CalcProfitInput): ProfitCalcResult {
  const { sellPrice, cost, pkgCost, shipCost, ebayFee } = input
  validateCalcProfitInput(input)

  const ebayFees  = sellPrice * (ebayFee / 100)
  const totalFees = pkgCost + shipCost + ebayFees
  const totalCost = cost + totalFees
  const net       = sellPrice - totalCost
  const roi       = cost > 0 ? (net / cost) * 100 : null
  const margin    = sellPrice > 0 ? (net / sellPrice) * 100 : 0

  return {
    gross:      sellPrice,
    ebayFees:   round2(ebayFees),
    pkgCost:    round2(pkgCost),
    shipCost:   round2(shipCost),
    totalFees:  round2(totalFees),
    net:        round2(net),
    roi:        roi === null ? null : round2(roi),
    margin:     round2(margin),
  }
}

function validateCalcProfitInput(input: CalcProfitInput): void {
  const { sellPrice, cost, pkgCost, shipCost, ebayFee } = input
  for (const [name, value] of Object.entries({ sellPrice, cost, pkgCost, shipCost, ebayFee })) {
    if (!Number.isFinite(value)) throw new Error(`calcProfit: ${name} must be a finite number`)
  }
  if (sellPrice < 0) throw new Error('calcProfit: sellPrice must be >= 0')
  if (cost < 0) throw new Error('calcProfit: cost must be >= 0')
  if (pkgCost < 0) throw new Error('calcProfit: pkgCost must be >= 0')
  if (shipCost < 0) throw new Error('calcProfit: shipCost must be >= 0')
  if (ebayFee < 0) throw new Error('calcProfit: ebayFee must be >= 0')
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
