import type { MaxBuyPriceInputs, MaxBuyPriceResult } from "../types";

// When the user leaves acquisition cost blank, the engine must never invent
// one (e.g. avgSoldPrice * 0.10). Instead it solves backward for the highest
// acquisition price that still satisfies BOTH the user's configured minimum
// profit and target ROI, so the UI can say "HOT at $X or less" / "LIST at $X
// or less" instead of fabricating a purchase cost.
//
// Pure deterministic math only — no AI, no external calls, no decision-making
// (market thresholds like sell-through/days/demand are evaluated separately
// by the decision engine against verified evidence).
export function calcMaxBuyPrice(inputs: MaxBuyPriceInputs): MaxBuyPriceResult {
  const { sellPrice, ebayFee, pkgCost, shipCost, minProfit, targetRoi } = inputs
  validateMaxBuyPriceInput(inputs)

  // Amount left over after eBay fee, packaging, and seller-borne shipping —
  // before subtracting acquisition cost.
  const grossAfterFees = sellPrice - pkgCost - shipCost - sellPrice * (ebayFee / 100)

  // Constraint 1: net profit (grossAfterFees - cost) >= minProfit
  //   => cost <= grossAfterFees - minProfit
  const costForMinProfit = grossAfterFees - minProfit

  // Constraint 2: roi = (grossAfterFees - cost) / cost * 100 >= targetRoi
  //   => cost <= grossAfterFees / (1 + targetRoi / 100)
  const roiDivisor = 1 + targetRoi / 100
  const costForTargetRoi = roiDivisor > 0 ? grossAfterFees / roiDivisor : -Infinity

  const maxCostRaw = Math.min(costForMinProfit, costForTargetRoi)

  if (maxCostRaw <= 0) {
    return { maxCost: null, limitedBy: 'none' }
  }

  const EPSILON = 0.005
  let limitedBy: MaxBuyPriceResult['limitedBy']
  if (Math.abs(costForMinProfit - costForTargetRoi) <= EPSILON) {
    limitedBy = 'both'
  } else if (costForMinProfit < costForTargetRoi) {
    limitedBy = 'minProfit'
  } else {
    limitedBy = 'targetRoi'
  }

  return { maxCost: round2(maxCostRaw), limitedBy }
}

function validateMaxBuyPriceInput(input: MaxBuyPriceInputs): void {
  const { sellPrice, ebayFee, pkgCost, shipCost, minProfit, targetRoi } = input
  for (const [name, value] of Object.entries({ sellPrice, ebayFee, pkgCost, shipCost, minProfit, targetRoi })) {
    if (!Number.isFinite(value)) throw new Error(`calcMaxBuyPrice: ${name} must be a finite number`)
  }
  if (sellPrice < 0) throw new Error('calcMaxBuyPrice: sellPrice must be >= 0')
  if (ebayFee < 0) throw new Error('calcMaxBuyPrice: ebayFee must be >= 0')
  if (pkgCost < 0) throw new Error('calcMaxBuyPrice: pkgCost must be >= 0')
  if (shipCost < 0) throw new Error('calcMaxBuyPrice: shipCost must be >= 0')
  if (minProfit < 0) throw new Error('calcMaxBuyPrice: minProfit must be >= 0')
  if (targetRoi < 0) throw new Error('calcMaxBuyPrice: targetRoi must be >= 0')
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
