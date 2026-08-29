import type { DecisionInputs, DecisionResult, ScanDecision } from "../types";

// The single authoritative HOT / LIST / SKIP function.
//
// Profit Scanner v2 (cross-market resale opportunity architecture): the
// decision no longer depends on sell-through rate, days-to-sell, or demand
// level. Those were eBay-sold/active-listing-specific signals that don't
// generalize across marketplaces (Etsy, Reverb, Discogs, ...) and are
// removed from decision authority entirely — see the marketplace opportunity
// engine (marketplaceOpportunity.ts) for where marketplace selection now
// lives. If demand/velocity is ever surfaced again, it must be informational
// only, never a gating input here.
//
// Inputs must already be resolved: real/deterministic financial values from
// calcProfit (net profit + ROI for the item's BEST marketplace, chosen by
// the opportunity engine), and a marketplace-independent evidence-quality
// tier (evidenceQuality.ts) for that same marketplace's evidence. This
// function makes no AI calls, no external calls, and never fetches user
// settings itself.
//
// Rules (non-negotiable — see docs/files/DECISIONS.md):
//   HOT  = profitPass && roiPass && evidenceQuality === 'strong'
//   LIST = profitPass && roiPass && evidenceQuality === 'moderate'
//   SKIP = profitPass fails or roiPass fails (evidence is strong or moderate
//          — weak/none evidence must never reach decide() at all; the
//          caller reports LIMITED EVIDENCE instead, see
//          resolveScanResultCore in claude-proxy/index.ts)
//
// A null roi means a genuine $0 acquisition cost (see calcProfit) — ROI is
// not a meaningful ratio for a free item, so it is neither fabricated nor
// treated as a failure: the ROI threshold is bypassed (roiPass = true) and
// the profit threshold remains fully authoritative.
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
    // evidenceQuality === 'moderate' — weak/none must never reach decide()
    decision = 'LIST'
  }

  return { decision, profitPass, roiPass, failingThresholds }
}
