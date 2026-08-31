import type { IdentityCandidate, SoldCompListing } from "./marketData.ts"

export interface QueryCandidate {
  query: string
  // R2 (§5.4): 'exact_identifier_variant' added for queryPlanner.ts's GTIN
  // rung (rung 1) — a validated barcode match is the strongest identity
  // signal available, matching CompMatchPrecision's existing top tier.
  precision: 'exact_identifier_variant' | 'exact_model_variant' | 'exact_model' | 'product_family' | 'substitute'
}

export interface ExcludedComp {
  itemId: string
  title: string
  soldPrice: number
  reason: string
}

export interface CompSelectionResult {
  retained: SoldCompListing[]
  excluded: ExcludedComp[]
}

const CONTAMINATION_MARKERS = [
  'for parts', 'parts only', 'not working', 'repair only', 'as is',
  'manual only', 'box only', 'empty box', 'case only', 'replacement only',
  'charger only', 'adapter only', 'remote only', 'cover only', 'stand only',
  'lot of', 'bundle of', 'wholesale lot',
]

function normalize(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// Exported for reuse by queryPlanner.ts (R2 §5.4) — the same "what's left of
// the item name once brand/model/variant/filler words are stripped" logic a
// query rung and a head-noun heuristic both need.
export function productFamily(identity: IdentityCandidate): string {
  const removals = [identity.brand, identity.model, identity.variant]
    .map(normalize).filter(Boolean)
  return normalize(identity.itemName)
    .split(' ')
    .filter(token => !removals.some(value => value.split(' ').includes(token)))
    .filter(token => !['model', 'series', 'vintage', 'rare', 'tested', 'working'].includes(token))
    .join(' ')
}

function scannedItemIsContaminationType(identity: IdentityCandidate, marker: string): boolean {
  const identityText = normalize([identity.itemName, identity.conditionHints].filter(Boolean).join(' '))
  return identityText.includes(normalize(marker))
}

function conditionMismatch(identity: IdentityCandidate, comp: SoldCompListing): boolean {
  const wanted = normalize(identity.conditionHints)
  const actual = normalize(comp.condition)
  if (!wanted || !actual) return false
  const wantsNew = /\b(new|sealed|unopened)\b/.test(wanted)
  const compNew = /\b(new|sealed|unopened)\b/.test(actual)
  return wantsNew && !compNew
}

export function selectComparableSoldComps(
  comps: SoldCompListing[],
  identity: IdentityCandidate,
  candidate: QueryCandidate,
): CompSelectionResult {
  const retained: SoldCompListing[] = []
  const excluded: ExcludedComp[] = []
  const brand = normalize(identity.brand)
  const model = normalize(identity.model)
  const familyTokens = productFamily(identity).split(' ').filter(token => token.length >= 3)

  for (const comp of comps) {
    const title = normalize(comp.title)
    let reason: string | null = null
    const marker = CONTAMINATION_MARKERS.find(value =>
      title.includes(normalize(value)) && !scannedItemIsContaminationType(identity, value)
    )
    if (marker) reason = `contamination marker: ${marker}`
    else if (conditionMismatch(identity, comp)) reason = 'condition mismatch'
    else if (candidate.precision.startsWith('exact_model') && model && !title.includes(model)) reason = 'model mismatch'
    else if (candidate.precision.startsWith('exact_model') && brand && !title.includes(brand)) reason = 'brand mismatch'
    else if (familyTokens.length) {
      const matches = familyTokens.filter(token => title.includes(token)).length
      const required = Math.max(1, Math.ceil(familyTokens.length / 2))
      if (matches < required) reason = 'insufficient product-family overlap'
    }

    if (reason) excluded.push({ itemId: comp.itemId, title: comp.title, soldPrice: comp.soldPrice, reason })
    else retained.push(comp)
  }
  return { retained, excluded }
}

// Generic p20/p80 spread coherence check — used for sold-comp prices
// (isCoherentPriceSet below) and, by marketDataPipeline.ts, for active-market
// asking-price evidence (Profit Scanner v2 evidence-quality assessment).
// Prices don't need to be sorted on input.
export function isCoherentPriceSpread(prices: number[]): boolean {
  if (prices.length < 3) return false
  const sorted = [...prices].sort((a, b) => a - b)
  const p20 = sorted[Math.floor((sorted.length - 1) * 0.20)]
  const p80 = sorted[Math.floor((sorted.length - 1) * 0.80)]
  return Number.isFinite(p20) && Number.isFinite(p80) && p20 > 0 && p80 / p20 <= 6
}

export function isCoherentPriceSet(comps: SoldCompListing[]): boolean {
  return isCoherentPriceSpread(comps.map(comp => comp.soldPrice))
}
