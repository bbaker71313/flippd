import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseModelToken, parseVariantToken, parseGtinToken, parseConditionToken, isReasonablyIdentifiable } from "./identityNormalization.ts";
import type { IdentityCandidate } from "./marketData.ts";

// ── parseModelToken — the two real production examples from the task doc ──

Deno.test('parseModelToken: "Unknown - model number not visible in photo" rejects, nothing to salvage', () => {
  const result = parseModelToken("Unknown - model number not visible in photo");
  assertEquals(result.model, null);
  assertEquals(result.modelFamilyHint, null);
});

Deno.test('parseModelToken: "P-series (exact model not confirmed - likely P800 or similar tabletop variant)" salvages the family hint, never accepts as a model', () => {
  const result = parseModelToken("P-series (exact model not confirmed - likely P800 or similar tabletop variant)");
  assertEquals(result.model, null);
  assertEquals(result.modelFamilyHint, "p-series");
});

// ── The explicit "naive regex wrongly accepts this" case (task doc §5.3) ──

Deno.test('parseModelToken: bare "P-series" is salvaged as a family hint, not accepted as a model (no digit present)', () => {
  const result = parseModelToken("P-series");
  assertEquals(result.model, null);
  assertEquals(result.modelFamilyHint, "p-series");
});

// ── Valid models are still accepted ──

Deno.test('parseModelToken: a real hyphenated alphanumeric model with a digit is accepted', () => {
  assertEquals(parseModelToken("X-700"), { model: "X-700", modelFamilyHint: null });
});

Deno.test('parseModelToken: a two-token digit-bearing model is accepted', () => {
  assertEquals(parseModelToken("SM 57"), { model: "SM 57", modelFamilyHint: null });
});

Deno.test('parseModelToken: a short pure-alpha code is accepted', () => {
  assertEquals(parseModelToken("GTX"), { model: "GTX", modelFamilyHint: null });
});

// ── Rejection rules ──

Deno.test('parseModelToken: more than 3 tokens is rejected outright, nothing salvaged', () => {
  const result = parseModelToken("Portable AM FM Radio");
  assertEquals(result.model, null);
  assertEquals(result.modelFamilyHint, null);
});

Deno.test('parseModelToken: sentence punctuation is rejected outright', () => {
  const result = parseModelToken("It is a 7-2880.");
  assertEquals(result.model, null);
  assertEquals(result.modelFamilyHint, null);
});

Deno.test('parseModelToken: null and blank input are both null/null, never thrown on', () => {
  assertEquals(parseModelToken(null), { model: null, modelFamilyHint: null });
  assertEquals(parseModelToken("   "), { model: null, modelFamilyHint: null });
});

// ── parseVariantToken ──

Deno.test('parseVariantToken: a clean color/size variant is accepted without requiring a digit', () => {
  assertEquals(parseVariantToken("Black 256GB"), "Black 256GB");
});

Deno.test('parseVariantToken: a hedge phrase is rejected', () => {
  assertEquals(parseVariantToken("possibly a limited edition"), null);
});

Deno.test('parseVariantToken: null input is null', () => {
  assertEquals(parseVariantToken(null), null);
});

// ── parseGtinToken ──

Deno.test('parseGtinToken: a 12-digit UPC-A is accepted', () => {
  assertEquals(parseGtinToken("012345678905"), { gtin: "012345678905", gtinKind: "UPC" });
});

Deno.test('parseGtinToken: formatting spaces/hyphens are stripped before validating', () => {
  assertEquals(parseGtinToken("0 12345 67890 5"), { gtin: "012345678905", gtinKind: "UPC" });
});

Deno.test('parseGtinToken: a 13-digit Bookland (978/979) EAN is classified ISBN', () => {
  assertEquals(parseGtinToken("9781234567897"), { gtin: "9781234567897", gtinKind: "ISBN" });
});

Deno.test('parseGtinToken: a plain 13-digit EAN not in the Bookland range is classified EAN', () => {
  assertEquals(parseGtinToken("4006381333931"), { gtin: "4006381333931", gtinKind: "EAN" });
});

Deno.test('parseGtinToken: a 14-digit code is classified GTIN', () => {
  assertEquals(parseGtinToken("10012345678902"), { gtin: "10012345678902", gtinKind: "GTIN" });
});

Deno.test('parseGtinToken: non-digit content is rejected, never coerced', () => {
  assertEquals(parseGtinToken("barcode not visible"), { gtin: null, gtinKind: null });
});

Deno.test('parseGtinToken: an implausible digit length is rejected', () => {
  assertEquals(parseGtinToken("12345"), { gtin: null, gtinKind: null });
});

Deno.test('parseGtinToken: null input is null/null', () => {
  assertEquals(parseGtinToken(null), { gtin: null, gtinKind: null });
});

// ── R3: parseConditionToken — binary NEW/USED only ──────────────────────────

Deno.test('parseConditionToken: null/empty input is null (T1: missing scores neutral)', () => {
  assertEquals(parseConditionToken(null), null);
  assertEquals(parseConditionToken('   '), null);
});

Deno.test('parseConditionToken: "Brand new, sealed in box" is NEW', () => {
  assertEquals(parseConditionToken('Brand new, sealed in box'), 'NEW');
});

Deno.test('parseConditionToken: anything else non-empty is USED — no grading tiers', () => {
  assertEquals(parseConditionToken('Good condition, light wear'), 'USED');
  assertEquals(parseConditionToken('Excellent, barely used'), 'USED');
  assertEquals(parseConditionToken('Fair, some scratches'), 'USED');
});

Deno.test('parseConditionToken: "knobs appear new" hedge language never parses as NEW (DECISIONS.md named example)', () => {
  assertEquals(parseConditionToken('Knobs appear new, case has scratches'), 'USED');
  assertEquals(parseConditionToken('Looks almost new'), 'USED');
});

// ── R3: isReasonablyIdentifiable — the M gate ───────────────────────────────

function baseIdentity(overrides: Partial<IdentityCandidate>): IdentityCandidate {
  return {
    itemName: null, brand: null, model: null, variant: null, gtin: null, gtinKind: null,
    manufacturerPartNumber: null, modelFamilyHint: null, likelyEbayCategory: null,
    categoryHints: [], conditionHints: null, unresolvedAttributes: [], identityConfidence: 0,
    evidenceUsed: [], normalizedSearchTerms: [], providerId: 'test',
    ...overrides,
  };
}

Deno.test('isReasonablyIdentifiable: a validated GTIN alone qualifies', () => {
  assertEquals(isReasonablyIdentifiable(baseIdentity({ gtin: '012345678905', gtinKind: 'UPC' })), true);
});

Deno.test('isReasonablyIdentifiable: brand+model together qualifies', () => {
  assertEquals(isReasonablyIdentifiable(baseIdentity({ brand: 'GE', model: '7-2880' })), true);
});

Deno.test('isReasonablyIdentifiable: brand alone (no model) does NOT qualify without a distinguishing attribute', () => {
  assertEquals(isReasonablyIdentifiable(baseIdentity({ brand: 'GE', itemName: 'radio' })), false);
});

Deno.test('isReasonablyIdentifiable: brand + a non-generic item name qualifies (product type + brand + distinguishing attribute)', () => {
  assertEquals(isReasonablyIdentifiable(baseIdentity({ brand: 'GE', itemName: 'GE Super Radio' })), true);
});

Deno.test('isReasonablyIdentifiable: a confident SerpAPI title match qualifies even with no brand/model', () => {
  assertEquals(isReasonablyIdentifiable(baseIdentity({
    itemName: 'Minolta X-700 35mm SLR Film Camera', evidenceUsed: ['visual_product_search'],
  })), true);
});

Deno.test('isReasonablyIdentifiable: a SerpAPI match that is still just a bare generic noun does NOT qualify', () => {
  assertEquals(isReasonablyIdentifiable(baseIdentity({ itemName: 'camera', evidenceUsed: ['visual_product_search'] })), false);
});

Deno.test('isReasonablyIdentifiable: bare generic nouns ("radio", "shirt", "camera", "book") with nothing else do NOT qualify', () => {
  for (const name of ['radio', 'shirt', 'camera', 'book']) {
    assertEquals(isReasonablyIdentifiable(baseIdentity({ itemName: name })), false, `expected "${name}" alone to not qualify`);
  }
});

Deno.test('isReasonablyIdentifiable: completely empty identity does not qualify', () => {
  assertEquals(isReasonablyIdentifiable(baseIdentity({})), false);
});
