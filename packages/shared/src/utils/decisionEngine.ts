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
// evidence of qualifying. A null roi means a genuine $0 acquisition cost
// (see calcProfit) — ROI is not a meaningful ratio for a free item, so it is
// neither fabricated nor treated as a failure: the ROI threshold is bypassed
// (roiPass = true) and the other thresholds (profit/STR/days/demand) remain
// fully authoritative.
export function decide(inputs: DecisionInputs): DecisionResult {
  const {
    netProfit, roi, sellThroughRate, daysToSell, demandLevel,
    minProfit, targetRoi, minSellThroughRate, maxDaysToSell,
  } = inputs

  const profitPass = netProfit >= minProfit
  // null roi = $0 acquisition cost: bypass, don't fail (see comment above)
  const roiPass = roi === null ? true : roi >= targetRoi
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
