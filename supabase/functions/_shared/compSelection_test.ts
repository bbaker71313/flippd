import {
  isCoherentPriceSet, selectComparableSoldComps,
} from "./compSelection.ts";
import type { QueryCandidate } from "./compSelection.ts";
import type { IdentityCandidate, SoldCompListing } from "./marketData.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const IDENTITY: IdentityCandidate = {
  itemName: 'GE Super Radio 7-2880', brand: 'GE', model: '7-2880', variant: null,
  gtin: null, gtinKind: null, manufacturerPartNumber: null, modelFamilyHint: null,
  likelyEbayCategory: 'Portable AM FM Radios', categoryHints: ['Portable AM FM Radios'],
  conditionHints: 'Used, working', unresolvedAttributes: [], identityConfidence: 90,
  evidenceUsed: ['visual_ai'], normalizedSearchTerms: [], providerId: 'test',
};

function comp(itemId: string, title: string, soldPrice: number, condition = 'Used'): SoldCompListing {
  return {
    itemId, title, soldPrice, totalPrice: soldPrice, shippingPrice: null,
    shippingType: null, currency: 'USD', endedAt: '2026-08-01T00:00:00Z',
    condition, conditionId: '3000', buyingFormat: 'FIXED_PRICE', bidCount: null,
    bestOfferAccepted: false, listingType: 'FixedPrice', listingUrl: null,
    sellerFeedbackScore: null, sellerFeedbackPercent: null,
  };
}

// Query-cascade planning (formerly buildSoldCompsQueries here) moved to
// queryPlanner.ts (R2 §5.4, provider-aware) — see queryPlanner_test.ts for
// cascade/dedup/truncation coverage. This file now only tests comp matching.
const EXACT_MODEL_CANDIDATE: QueryCandidate = { query: 'ge 7 2880', precision: 'exact_model' };

Deno.test('comp selection removes parts, lots, and model mismatches', () => {
  const candidate = EXACT_MODEL_CANDIDATE;
  const result = selectComparableSoldComps([
    comp('1', 'GE Super Radio 7-2880 AM FM Portable Radio', 45),
    comp('2', 'GE Super Radio 7-2880 For Parts Not Working', 8),
    comp('3', 'Lot of 4 GE Portable Radios', 100),
    comp('4', 'GE Super Radio 7-2885 AM FM Portable Radio', 55),
  ], IDENTITY, candidate);
  assertEquals(result.retained.map(item => item.itemId), ['1']);
  assertEquals(result.excluded.length, 3);
});

Deno.test('coherence guard rejects a mixed 100x price population', () => {
  assertEquals(isCoherentPriceSet([
    comp('1', 'GE Super Radio 7-2880', 0.99),
    comp('2', 'GE Super Radio 7-2880', 40),
    comp('3', 'GE Super Radio 7-2880', 99),
  ]), false);
});

Deno.test('coherence guard accepts three closely grouped prices', () => {
  assertEquals(isCoherentPriceSet([
    comp('1', 'GE Super Radio 7-2880', 35),
    comp('2', 'GE Super Radio 7-2880', 40),
    comp('3', 'GE Super Radio 7-2880', 50),
  ]), true);
});
