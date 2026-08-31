// R3: getReverbMarketplaceEvidence (docs/files/DECISIONS.md "Reverb...
// pulled into R3..."). Covers: NOT_CONFIGURED when REVERB_API_KEY is
// absent, the happy path (T2 proportional support qualifies -> moderate,
// never strong), and the T2 floor (not enough retained/proportion -> a
// reported EVIDENCE_TOO_WEAK failure, never a fabricated qualifying result).
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getReverbMarketplaceEvidence } from "./reverbEvidence.ts";
import type { IdentityCandidate } from "./marketData.ts";

const ENV_NAME = 'REVERB_API_KEY';
const originalFetch = globalThis.fetch;

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const prior: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    prior[k] = Deno.env.get(k);
    if (vars[k] === undefined) Deno.env.delete(k); else Deno.env.set(k, vars[k]!);
  }
  return fn().finally(() => {
    for (const k of Object.keys(vars)) {
      if (prior[k] === undefined) Deno.env.delete(k); else Deno.env.set(k, prior[k]!);
    }
  });
}

function mockFetch(handler: () => Response | Promise<Response>): typeof fetch {
  return (() => Promise.resolve(handler())) as typeof fetch;
}

const IDENTITY: IdentityCandidate = {
  itemName: 'Fender Stratocaster Electric Guitar', brand: 'Fender', model: 'Stratocaster', variant: null,
  gtin: null, gtinKind: null, manufacturerPartNumber: null, modelFamilyHint: null,
  likelyEbayCategory: 'Guitars', categoryHints: ['Guitars'], conditionHints: 'Used',
  unresolvedAttributes: [], identityConfidence: 85, evidenceUsed: ['visual_ai'],
  normalizedSearchTerms: ['fender stratocaster'], providerId: 'test',
};

function listingsResponse(prices: number[]): Response {
  return new Response(JSON.stringify({
    listings: prices.map((p, i) => ({
      id: String(i), title: 'Fender Stratocaster Electric Guitar', price: { amount: String(p), currency: 'USD' },
      condition: { display_name: 'Used' }, _links: { web: { href: `https://reverb.com/item/${i}` } },
    })),
  }), { status: 200 });
}

Deno.test('getReverbMarketplaceEvidence: NOT_CONFIGURED when REVERB_API_KEY is absent', async () => {
  const result = await withEnv({ [ENV_NAME]: undefined }, () => getReverbMarketplaceEvidence(IDENTITY));
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.reason, 'NOT_CONFIGURED');
});

Deno.test('getReverbMarketplaceEvidence: enough coherent retained listings qualifies as moderate — never strong (§8.1 class ceiling)', async () => {
  globalThis.fetch = mockFetch(() => listingsResponse([700, 720, 710, 715, 705, 725]));
  try {
    const result = await withEnv({ [ENV_NAME]: 'test-key' }, () => getReverbMarketplaceEvidence(IDENTITY));
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.evidence.evidenceType, 'active_market');
      assertEquals(result.evidence.evidenceQuality, 'moderate');
      assertEquals(result.evidence.marketplace, 'reverb');
    }
  } finally { globalThis.fetch = originalFetch; }
});

Deno.test('getReverbMarketplaceEvidence: below the T2 floor (fewer than 5 retained) reports EVIDENCE_TOO_WEAK, never a fabricated qualifying result', async () => {
  globalThis.fetch = mockFetch(() => listingsResponse([700, 720, 710]));
  try {
    const result = await withEnv({ [ENV_NAME]: 'test-key' }, () => getReverbMarketplaceEvidence(IDENTITY));
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.reason, 'EVIDENCE_TOO_WEAK');
  } finally { globalThis.fetch = originalFetch; }
});

Deno.test('getReverbMarketplaceEvidence: no usable listings reports INSUFFICIENT_VERIFIED_MARKET_DATA, never a fabricated zero', async () => {
  globalThis.fetch = mockFetch(() => new Response(JSON.stringify({ listings: [] }), { status: 200 }));
  try {
    const result = await withEnv({ [ENV_NAME]: 'test-key' }, () => getReverbMarketplaceEvidence(IDENTITY));
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.reason, 'INSUFFICIENT_VERIFIED_MARKET_DATA');
  } finally { globalThis.fetch = originalFetch; }
});

Deno.test('getReverbMarketplaceEvidence: an HTTP 500 is reported as PROVIDER_UNAVAILABLE, never a fabricated zero', async () => {
  globalThis.fetch = mockFetch(() => new Response('server error', { status: 500 }));
  try {
    const result = await withEnv({ [ENV_NAME]: 'test-key' }, () => getReverbMarketplaceEvidence(IDENTITY));
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.reason, 'PROVIDER_UNAVAILABLE');
  } finally { globalThis.fetch = originalFetch; }
});
