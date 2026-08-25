import type { DecisionInputs, DecisionResult, ScanDecision } from "../types";

// The single authoritative HOT / LIST / SKIP function (Chapter 02 audit).
//
// Inputs must already be resolved: real/deterministic financial values from
// calcProfit, and verified market evidence (never AI confidence, never a
// sourcing-style multiplier). This function makes no AI calls, no external
// calls, and never fetches user settings itself.
//
// Rules (non-negotiable — see docs/files/DECISIONS.md if migrated there):
//   HOT  = profitPass && roiPass && strPass && daysPass && demand === 'VERY HIGH'
//   LIST = profitPass && roiPass && strPass && daysPass && demand !== 'VERY HIGH'
//   SKIP = any required threshold fails
//
// A null market value (sellThroughRate/daysToSell/demandLevel unavailable)
// fails that threshold rather than passing it — missing evidence is not
// evidence of qualifying. A null roi (zero/undefined acquisition cost) fails
// the ROI threshold for the same reason.
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

  return {
    decision,
    profitPass, roiPass, strPass, daysPass, demandIsVeryHigh,
    failingThresholds,
  }
}
