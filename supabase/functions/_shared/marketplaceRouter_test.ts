// Run: `deno test supabase/functions/_shared/`
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { routeMarketplaces } from "./marketplaceRouter.ts";
import type { IdentityCandidate } from "./marketData.ts";

function identity(overrides: Partial<IdentityCandidate>): IdentityCandidate {
  return {
    itemName: null, brand: null, model: null, variant: null, gtin: null, gtinKind: null,
    manufacturerPartNumber: null, likelyEbayCategory: null, categoryHints: [],
    conditionHints: null, unresolvedAttributes: [], identityConfidence: 80,
    evidenceUsed: ['visual_ai'], normalizedSearchTerms: [], providerId: 'test',
    ...overrides,
  };
}

Deno.test("eBay is always included as the universal baseline", () => {
  const ids = routeMarketplaces(identity({ itemName: 'Generic unidentified widget' }));
  assertEquals(ids.includes('ebay'), true);
});

Deno.test("guitar pedal routes to Reverb", () => {
  const ids = routeMarketplaces(identity({ itemName: 'Boss DS-1 Distortion Pedal' }));
  assertEquals(ids.includes('reverb'), true);
});

Deno.test("vinyl record routes to Discogs", () => {
  const ids = routeMarketplaces(identity({ itemName: 'Pink Floyd Dark Side of the Moon Vinyl LP' }));
  assertEquals(ids.includes('discogs'), true);
});

Deno.test("vintage pottery routes to Etsy", () => {
  const ids = routeMarketplaces(identity({ itemName: 'Vintage Studio Pottery Vase', categoryHints: ['Collectibles'] }));
  assertEquals(ids.includes('etsy'), true);
});

Deno.test("designer handbag routes to Etsy, Poshmark, and Mercari", () => {
  const ids = routeMarketplaces(identity({ itemName: 'Coach Designer Leather Handbag' }));
  assertEquals(ids.includes('etsy'), true);
  assertEquals(ids.includes('poshmark'), true);
  assertEquals(ids.includes('mercari'), true);
});

Deno.test("bulky furniture routes to Facebook/local", () => {
  const ids = routeMarketplaces(identity({ itemName: 'Large Oak Dresser' }));
  assertEquals(ids.includes('facebook_local'), true);
});

Deno.test("a fully generic unidentifiable item routes to eBay only", () => {
  const ids = routeMarketplaces(identity({}));
  assertEquals(ids, ['ebay']);
});

Deno.test("marketplace ids are never duplicated even when multiple rules overlap", () => {
  const ids = routeMarketplaces(identity({ itemName: 'Vintage designer leather jacket' }));
  assertEquals(new Set(ids).size, ids.length);
});
