// Deno-native mirror of packages/shared/src/utils/decisionEngine.ts.
// See financialEngine.ts for why this is duplicated rather than imported.
//
// The single authoritative HOT / LIST / SKIP function for every scan mode
// (single, text, shelf). Inputs must already be resolved — real financial
// values from calcProfit, and market evidence. This function makes no AI
// calls, no external calls, and never fetches user settings itself.
//
//   HOT  = profitPass && roiPass && strPass && daysPass && demand === 'VERY HIGH'
//   LIST = profitPass && roiPass && strPass && daysPass && demand !== 'VERY HIGH'
//   SKIP = any required threshold fails
//
// A null market value (unavailable) fails that threshold — missing evidence
// is not evidence of qualifying. Demand alone, or profit/ROI alone, never
// independently trigger HOT. No sourcing-style multiplier, no AI confidence
// substituting for a threshold.

export type DemandLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH'
export type ScanDecision = 'HOT' | 'LIST' | 'SKIP'

export interface DecisionInputs {
  netProfit: number
  roi: number | null
  sellThroughRate: number | null
  daysToSell: number | null
  demandLevel: DemandLevel | null
  minProfit: number
  targetRoi: number
  minSellThroughRate: number
  maxDaysToSell: number
}

export interface DecisionResult {
  decision: ScanDecision
  profitPass: boolean
  roiPass: boolean
  strPass: boolean
  daysPass: boolean
  demandIsVeryHigh: boolean
  failingThresholds: string[]
}

export function decide(inputs: DecisionInputs): DecisionResult {
  const {
    netProfit, roi, sellThroughRate, daysToSell, demandLevel,
    minProfit, targetRoi, minSellThroughRate, maxDaysToSell,
  } = inputs

  const profitPass = netProfit >= minProfit
  const roiPass = roi !== null && roi >= targetRoi
  const strPass = sellThroughRate !== null && sellThroughRate >= minSellThroughRate
  const daysPass = daysToSell !== null && daysToSell <= maxDaysToSell
  const demandIsVeryHigh = demandLevel === 'VERY HIGH'

  const failingThresholds: string[] = []
  if (!profitPass) failingThresholds.push('profit')
  if (!roiPass) failingThresholds.push('roi')
  if (!strPass) failingThresholds.push('sellThroughRate')
  if (!daysPass) failingThresholds.push('daysToSell')

  const allRequiredPass = profitPass && roiPass && strPass && daysPass

  let decision: ScanDecision
  if (!allRequiredPass) {
    decision = 'SKIP'
  } else if (demandIsVeryHigh) {
    decision = 'HOT'
  } else {
    decision = 'LIST'
  }

  return { decision, profitPass, roiPass, strPass, daysPass, demandIsVeryHigh, failingThresholds }
}
