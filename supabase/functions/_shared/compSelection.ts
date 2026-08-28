import type { IdentityCandidate, SoldCompListing } from "./marketData.ts"

export interface QueryCandidate {
  query: string
  precision: 'exact_model_variant' | 'exact_model' | 'product_family' | 'substitute'
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

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  return values.filter(value => {
    const key = normalize(value)
    if (key.length < 3 || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function productFamily(identity: IdentityCandidate): string {
  const removals = [identity.brand, identity.model, identity.variant]
    .map(normalize).filter(Boolean)
  return normalize(identity.itemName)
    .split(' ')
    .filter(token => !removals.some(value => value.split(' ').includes(token)))
    .filter(token => !['model', 'series', 'vintage', 'rare', 'tested', 'working'].includes(token))
    .join(' ')
}

export function buildSoldCompsQueries(identity: IdentityCandidate): QueryCandidate[] {
  const brand = normalize(identity.brand)
  const model = normalize(identity.model)
  const variant = normalize(identity.variant)
  const family = productFamily(identity)
  const name = normalize(identity.itemName)
  const candidates: QueryCandidate[] = [
    ...(variant ? [{ query: [brand, model, variant].filter(Boolean).join(' '), precision: 'exact_model_variant' as const }] : []),
    { query: [brand, model].filter(Boolean).join(' '), precision: 'exact_model' },
    { query: [brand, family].filter(Boolean).join(' '), precision: 'product_family' },
    { query: family, precision: 'product_family' },
    { query: name, precision: model ? 'exact_model' : 'substitute' },
  ]
  const allowed = new Set(unique(candidates.map(candidate => candidate.query)).map(normalize))
  return candidates.filter(candidate => allowed.delete(normalize(candidate.query)))
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

export function isCoherentPriceSet(comps: SoldCompListing[]): boolean {
  if (comps.length < 3) return false
  const prices = comps.map(comp => comp.soldPrice).sort((a, b) => a - b)
  const p20 = prices[Math.floor((prices.length - 1) * 0.20)]
  const p80 = prices[Math.floor((prices.length - 1) * 0.80)]
  return Number.isFinite(p20) && Number.isFinite(p80) && p20 > 0 && p80 / p20 <= 6
}
