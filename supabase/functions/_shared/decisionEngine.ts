// Deno-native mirror of packages/shared/src/utils/decisionEngine.ts.
// See financialEngine.ts for why this is duplicated rather than imported.
//
// The single authoritative HOT / LIST / SKIP function for every scan mode
// (single, text, shelf). Inputs must already be resolved — real financial
// values from calcProfit, and market evidence. This function makes no AI
// calls, no external calls, and never fetches user settings itself.
//
//   HOT  = profitPass && roiPass && strPass && daysPass && demand === 'VERY HIGH' && !evidenceIsWeak
//   LIST = profitPass && roiPass && strPass && daysPass && (demand !== 'VERY HIGH' || evidenceIsWeak)
//   SKIP = any required threshold fails
//
// A null market value (unavailable) fails that threshold — missing evidence
// is not evidence of qualifying. Demand alone, or profit/ROI alone, never
// independently trigger HOT. No sourcing-style multiplier, no AI confidence
// substituting for a threshold.
//
// A null roi means a genuine $0 acquisition cost (see financialEngine.ts) —
// ROI isn't a meaningful ratio for a free item, so it is neither fabricated
// nor treated as a failure: the ROI threshold is bypassed (roiPass = true)
// and the other thresholds stay fully authoritative.
//
// Decision Integrity remediation (Release A): an explicit weak/none
// evidenceQuality (small sold-comp sample — see marketMetrics.ts
// computeSoldPriceStats) caps the decision at LIST even when every threshold
// passes and demand is VERY HIGH. A 1-sold/0-active result must not carry
// the same authority as a 40-sold/0-active result. evidenceQuality is
// optional and omitted/moderate/strong is unrestricted (unchanged behavior).

export type DemandLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH'
export type ScanDecision = 'HOT' | 'LIST' | 'SKIP'
// Same bucketing as SoldPriceStats['evidenceQuality'] in marketData.ts.
export type EvidenceQuality = 'strong' | 'moderate' | 'weak' | 'none'

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
  // Optional: comp-sample-size evidence quality (marketMetrics.ts
  // computeSoldPriceStats). An explicit 'weak' or 'none' caps the decision
  // at LIST even when demand is VERY HIGH — a small sold-comp sample must
  // never carry the same authority as a large one. Omitted/null is
  // unrestricted (no evidence-quality signal supplied), same as
  // 'moderate'/'strong'.
  evidenceQuality?: EvidenceQuality | null
}

export interface DecisionResult {
  decision: ScanDecision
  profitPass: boolean
  roiPass: boolean
  strPass: boolean
  daysPass: boolean
  demandIsVeryHigh: boolean
  // True when every required threshold passed and demand was VERY HIGH, but
  // weak/none evidenceQuality capped the decision at LIST instead of HOT.
  hotCappedByEvidence: boolean
  failingThresholds: string[]
}

export function decide(inputs: DecisionInputs): DecisionResult {
  const {
    netProfit, roi, sellThroughRate, daysToSell, demandLevel,
    minProfit, targetRoi, minSellThroughRate, maxDaysToSell, evidenceQuality,
  } = inputs

  const profitPass = netProfit >= minProfit
  // null roi = $0 acquisition cost: bypass, don't fail (see comment above)
  const roiPass = roi === null ? true : roi >= targetRoi
  const strPass = sellThroughRate !== null && sellThroughRate >= minSellThroughRate
  const daysPass = daysToSell !== null && daysToSell <= maxDaysToSell
  const demandIsVeryHigh = demandLevel === 'VERY HIGH'
  // A small comp sample must never carry the same authority as a large one
  // (Decision Integrity remediation §8/§9): weak/none evidence can never
  // produce HOT, regardless of how strong the demand signal looks.
  const evidenceIsWeak = evidenceQuality === 'weak' || evidenceQuality === 'none'

  const failingThresholds: string[] = []
  if (!profitPass) failingThresholds.push('profit')
  if (!roiPass) failingThresholds.push('roi')
  if (!strPass) failingThresholds.push('sellThroughRate')
  if (!daysPass) failingThresholds.push('daysToSell')

  const allRequiredPass = profitPass && roiPass && strPass && daysPass
  const hotCappedByEvidence = allRequiredPass && demandIsVeryHigh && evidenceIsWeak

  let decision: ScanDecision
  if (!allRequiredPass) {
    decision = 'SKIP'
  } else if (demandIsVeryHigh && !evidenceIsWeak) {
    decision = 'HOT'
  } else {
    decision = 'LIST'
  }

  return { decision, profitPass, roiPass, strPass, daysPass, demandIsVeryHigh, hotCappedByEvidence, failingThresholds }
}
