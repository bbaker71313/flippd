// Deno-native mirror of packages/shared/src/utils/maxBuyPrice.ts.
// See financialEngine.ts for why this is duplicated rather than imported.
//
// When acquisition cost is unknown (left blank), solve backward for the
// highest price that still clears the user's configured minimum profit AND
// target ROI, instead of inventing a cost from sale price.

export interface MaxBuyPriceInputs {
  sellPrice: number
  ebayFee: number
  pkgCost: number
  shipCost: number
  minProfit: number
  targetRoi: number
}

export interface MaxBuyPriceResult {
  maxCost: number | null
  limitedBy: 'minProfit' | 'targetRoi' | 'both' | 'none'
}

export function calcMaxBuyPrice(inputs: MaxBuyPriceInputs): MaxBuyPriceResult {
  const { sellPrice, ebayFee, pkgCost, shipCost, minProfit, targetRoi } = inputs
  validateMaxBuyPriceInput(inputs)

  const grossAfterFees = sellPrice - pkgCost - shipCost - sellPrice * (ebayFee / 100)

  const costForMinProfit = grossAfterFees - minProfit

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
