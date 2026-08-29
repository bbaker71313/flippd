// MarketplaceRouter (task doc §7) — determines which marketplaces are worth
// checking for a given identified item, category-aware. Does not query every
// marketplace for every scan. Purely a lookup table over identification text
// — no API calls, no financial math, no decision-making.
//
// eBay is always included: it's the universal baseline marketplace this app
// already supports end-to-end. Every other marketplace is added only when
// the item's identification text matches that marketplace's category fit.
import type { IdentityCandidate } from "./marketData.ts"
import type { MarketplaceId } from "./marketplaceTypes.ts"

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const RULES: Array<{ pattern: RegExp; marketplaces: MarketplaceId[] }> = [
  // Guitar / pedal / pro audio -> Reverb
  { pattern: /\b(guitar|bass guitar|pedal|amp|amplifier|keyboard|synth|synthesizer|pro ?audio|recording|mixer|microphone|turntable|dj controller|drum machine)\b/, marketplaces: ['reverb'] },
  // Vinyl / collectible music -> Discogs
  { pattern: /\b(vinyl|record|lp\b|45 rpm|cassette tape|cd\b|album)\b/, marketplaces: ['discogs'] },
  // Vintage / handmade / décor / collectibles -> Etsy
  { pattern: /\b(vintage|handmade|craft|pottery|ceramic|glassware|decor|collectible|antique|figurine)\b/, marketplaces: ['etsy'] },
  // Designer fashion / jewelry -> Etsy, Poshmark, Mercari
  { pattern: /\b(designer|fashion|clothing|apparel|shirt|dress|jacket|coat|shoe|sneaker|boot|handbag|purse|jewelry|watch|necklace|bracelet)\b/, marketplaces: ['etsy', 'poshmark', 'mercari'] },
  // Books / ISBN media -> Amazon
  { pattern: /\b(book|isbn|novel|textbook|dvd|blu-?ray)\b/, marketplaces: ['amazon'] },
  // Furniture / bulky goods -> local/Facebook first
  { pattern: /\b(furniture|sofa|couch|appliance|refrigerator|fridge|washer|dryer|treadmill|desk|dresser|mattress|table|cabinet)\b/, marketplaces: ['facebook_local'] },
  // Standard consumer electronics -> Mercari, local/Facebook (eBay already baseline)
  { pattern: /\b(electronics|phone|laptop|computer|tablet|console|camera|tv\b|television)\b/, marketplaces: ['mercari', 'facebook_local'] },
]

export function routeMarketplaces(identity: IdentityCandidate): MarketplaceId[] {
  const haystack = normalize([
    identity.itemName, identity.brand, identity.likelyEbayCategory,
    ...identity.categoryHints,
  ].filter((v): v is string => !!v).join(' '))

  const ids: MarketplaceId[] = ['ebay']
  for (const rule of RULES) {
    if (!rule.pattern.test(haystack)) continue
    for (const marketplace of rule.marketplaces) {
      if (!ids.includes(marketplace)) ids.push(marketplace)
    }
  }
  return ids
}
