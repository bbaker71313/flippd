import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseModelToken, parseVariantToken, parseGtinToken } from "./identityNormalization.ts";

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
