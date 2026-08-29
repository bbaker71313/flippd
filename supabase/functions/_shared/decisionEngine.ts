// Deno-native mirror of packages/shared/src/utils/decisionEngine.ts.
// See financialEngine.ts for why this is duplicated rather than imported.
//
// The single authoritative HOT / LIST / SKIP function for every scan mode
// (single, text, shelf). Inputs must already be resolved — real financial
// values from calcProfit for the item's BEST marketplace (chosen by
// marketplaceOpportunity.ts), and a marketplace-independent evidence-quality
// tier (evidenceQuality.ts) for that marketplace's evidence. This function
// makes no AI calls, no external calls, and never fetches user settings itself.
//
// Profit Scanner v2: sell-through rate, days-to-sell, and demand level are
// removed from decision authority — they were eBay-specific signals that
// don't generalize across marketplaces. If demand/velocity is ever surfaced
// again, it must be informational only (see marketMetrics.ts, still used for
// that purpose by Inventory/Listing Generator's SourcingMeta), never a
// gating input here.
//
//   HOT  = profitPass && roiPass && evidenceQuality === 'strong'
//   LIST = profitPass && roiPass && evidenceQuality === 'moderate'
//   SKIP = profitPass fails or roiPass fails
//
// evidenceQuality here is only ever 'strong' or 'moderate' — a caller must
// never invoke decide() with 'weak'/'none' evidence (see evidenceQuality.ts);
// those cases short-circuit to a LIMITED EVIDENCE result before any
// financial math or decision is computed (no fabricated HOT/LIST/SKIP, no
// fabricated profit/ROI/max-buy-price from indefensible evidence).
//
// A null roi means a genuine $0 acquisition cost (see financialEngine.ts) —
// ROI isn't a meaningful ratio for a free item, so it is neither fabricated
// nor treated as a failure: the ROI threshold is bypassed (roiPass = true)
// and the profit threshold stays fully authoritative.

export type DemandLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH'
export type ScanDecision = 'HOT' | 'LIST' | 'SKIP'
// Full evidence-quality bucketing (evidenceQuality.ts / marketplaceTypes.ts).
// decide() itself only ever accepts the two decision-capable tiers below —
// 'weak'/'none' must be filtered out by the caller before reaching here.
export type EvidenceQuality = 'strong' | 'moderate' | 'weak' | 'none'
export type DecisiveEvidenceQuality = 'strong' | 'moderate'

export interface DecisionInputs {
  netProfit: number
  roi: number | null
  minProfit: number
  targetRoi: number
  evidenceQuality: DecisiveEvidenceQuality
}

export interface DecisionResult {
  decision: ScanDecision
  profitPass: boolean
  roiPass: boolean
  failingThresholds: string[]
}

export function decide(inputs: DecisionInputs): DecisionResult {
  const { netProfit, roi, minProfit, targetRoi, evidenceQuality } = inputs

  const profitPass = netProfit >= minProfit
  // null roi = $0 acquisition cost: bypass, don't fail (see comment above)
  const roiPass = roi === null ? true : roi >= targetRoi

  const failingThresholds: string[] = []
  if (!profitPass) failingThresholds.push('profit')
  if (!roiPass) failingThresholds.push('roi')

  const allRequiredPass = profitPass && roiPass

  let decision: ScanDecision
  if (!allRequiredPass) {
    decision = 'SKIP'
  } else if (evidenceQuality === 'strong') {
    decision = 'HOT'
  } else {
    decision = 'LIST'
  }

  return { decision, profitPass, roiPass, failingThresholds }
}
