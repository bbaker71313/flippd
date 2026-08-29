// Marketplace-independent evidence-quality assessment (Profit Scanner v2,
// task doc §5). Replaces the old comp-count-only bucketing
// (marketMetrics.ts's evidenceQualityFromCompCount, still used for the
// *price-stats* SoldPriceStats.evidenceQuality field, which stays purely
// informational for Inventory/Listing Generator's SourcingMeta — see
// CLAUDE.md hard scope boundary). THIS function is the one decide()'s
// evidenceQuality input is derived from for the scanner's own decision.
//
// STRONG  — 3+ coherent, genuinely comparable verified sold transactions at
//           exact-identifier/exact-model precision. Can support HOT/LIST/SKIP.
// MODERATE — any of:
//   - 3+ coherent sold comps, but only product-family/substitute precision
//     (a real cluster, just not an exact-identity match)
//   - 1-2 verified sold transactions at exact precision, plus supporting
//     active-market evidence
//   - no usable sold evidence, but active-market evidence alone is strong
//     (5+ closely matched, consistently-priced active listings)
//   Can support LIST/SKIP, never HOT.
// WEAK    — a single sold comp or a handful of active listings with no
//           qualifying support — real data, just not enough to trust.
// NONE    — no usable evidence at all.
//
// Weak/none must never reach decide() — the caller reports LIMITED EVIDENCE
// instead of fabricating HOT/LIST/SKIP, profit, ROI, or a max-buy price.
import type { CompMatchPrecision } from "./marketData.ts";
import type { EvidenceQuality } from "./decisionEngine.ts";

export interface SoldEvidenceSignal {
  count: number
  precision: CompMatchPrecision
  // Passed the identity-aware coherence guard (see compSelection.ts
  // isCoherentPriceSet) — a defensible cluster, not scattered/contaminated.
  coherent: boolean
}

export interface ActiveEvidenceSignal {
  count: number
  // Several closely matched active listings with consistent asking prices —
  // not just "some listings exist".
  coherent: boolean
}

const EXACT_PRECISIONS: CompMatchPrecision[] = [
  'exact_identifier_variant', 'exact_model_variant', 'exact_model',
];

export function assessEvidenceQuality(input: {
  soldEvidence: SoldEvidenceSignal | null
  activeEvidence: ActiveEvidenceSignal | null
}): EvidenceQuality {
  const { soldEvidence, activeEvidence } = input;
  const soldCount = soldEvidence?.count ?? 0;
  const soldCoherent = soldEvidence?.coherent ?? false;
  const soldExact = soldEvidence ? EXACT_PRECISIONS.includes(soldEvidence.precision) : false;
  const activeCount = activeEvidence?.count ?? 0;
  const activeCoherent = activeEvidence?.coherent ?? false;

  if (soldCount >= 3 && soldCoherent && soldExact) return 'strong';
  if (soldCount >= 3 && soldCoherent) return 'moderate'; // coherent, but only family/substitute precision
  if (soldCount >= 1 && soldCount <= 2 && soldExact && activeCount >= 1) return 'moderate';
  if (soldCount === 0 && activeCount >= 5 && activeCoherent) return 'moderate';
  if (soldCount >= 1 || activeCount >= 1) return 'weak';
  return 'none';
}
