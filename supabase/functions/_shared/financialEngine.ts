// Deno-native mirror of packages/shared/src/utils/calcProfit.ts.
//
// Duplicated intentionally, not accidentally (P3-34, 2026-08-27): a relative
// cross-package import (supabase/functions/... -> packages/shared/...) is
// NOT safe to rely on for a production deploy today. Live-verified this
// session via the Supabase MCP deploy tool (`mcp__Supabase__deploy_edge_function`)
// against project dqgfpchkheznvanfgsmx — a function whose entrypoint imported
// `../../../packages/shared/src/utils/calcProfit.ts` failed to bundle
// ("Module not found: file:///packages/shared/src/utils/calcProfit.ts").
// More importantly, `mcp__Supabase__list_edge_functions` on this project's
// own ACTIVE functions shows their bundled `entrypoint_path`s were rooted at
// three DIFFERENT upload-root depths depending on which deploy mechanism/
// session deployed them (some at `source/<fn>/index.ts`, some at
// `source/functions/<fn>/index.ts`, others at
// `source/supabase/functions/<fn>/index.ts`) — meaning how many `../`
// segments are needed to reach `packages/shared/` is not stable across
// deploy tools, so a relative import that resolves under one deploy
// mechanism can silently fail to bundle (or resolve to the wrong file)
// under another. Until this repo standardizes on one deploy mechanism with
// a guaranteed upload root (or adopts an import map with an absolute/pinned
// path), this file is the single authoritative financial calculation for
// every Edge Function code path, and packages/shared/... is the
// authoritative version for the rest of the monorepo (web, tests).
// Keep the two in lockstep — same inputs, same outputs, same rounding —
// enforced by parity test fixtures in financialEngine_test.ts matching
// packages/shared/src/utils/calcProfit.test.ts.
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
