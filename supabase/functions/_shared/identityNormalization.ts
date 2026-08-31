// R2 (§5.3, P0-2). Every production scan reviewed (task doc, scans 62-68)
// returned prose where a model number belongs — "Unknown - model number not
// visible in photo", "P-series (exact model not confirmed - likely P800 or
// similar tabletop variant)". Feeding that straight into a sold-comp query
// poisons the whole cascade. This module validates AI-supplied identity
// tokens (model/variant/gtin) before they reach the query planner
// (queryPlanner.ts) or the comp scorer (compSelection.ts) — never AI's job
// to decide what counts as a real identifier, only to report what it read.

export interface ModelParseResult {
  model: string | null            // validated identifier, else null
  modelFamilyHint: string | null  // salvaged family signal, e.g. "p-series"
}

export interface GtinParseResult {
  gtin: string | null
  gtinKind: 'GTIN' | 'UPC' | 'EAN' | 'ISBN' | null
}

// Substring match, case-insensitive — deliberately broad (catches "unknown",
// "not visible", "unclear", etc. wherever they appear in the value) so a
// hedge phrase can't hide inside an otherwise-plausible-looking string.
const HEDGE_WORDS = [
  'unknown', 'not visible', 'unclear', 'n/a', 'none', 'likely', 'possibly',
  'appears', 'similar', 'approximately', 'maybe', 'cannot', 'unable',
];

// Sentence-ending/joining punctuation. Commas, hyphens, and parentheses are
// handled separately as segment delimiters (see splitPrimarySegment) rather
// than outright rejection, so a genuinely clean leading segment can still be
// salvaged from a longer hedge-qualified string.
const SENTENCE_PUNCTUATION = /[.!?]/;

function containsHedgeWord(value: string): boolean {
  const lower = value.toLowerCase();
  return HEDGE_WORDS.some((word) => lower.includes(word));
}

// AI identity fields routinely arrive as "clean token (a qualifying
// explanation)" or "clean token - a qualifying explanation" — the clean
// token is real signal, the parenthetical/trailing clause is where the
// hedging lives. Only the first segment is ever considered.
function splitPrimarySegment(value: string): string {
  const [primary] = value.split(/[(),;]| - /);
  return primary.trim();
}

// Accept a compact alphanumeric token of <=3 whitespace-separated parts
// containing at least one digit (e.g. "X-700", "SM 57"), or a single short
// pure-alpha code (e.g. "GTX"). Everything else is not a validated model —
// including a token like "P-series" that LOOKS compact and alphanumeric but
// has no digit, which is exactly the case a naive alphanumeric regex would
// wrongly accept (see parseModelToken's own test coverage).
function looksLikeValidatedToken(candidate: string): boolean {
  const tokens = candidate.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 3) return false;
  const isAlnumWithDigit = tokens.every((t) => /^[a-z0-9-]+$/i.test(t)) && tokens.some((t) => /\d/.test(t));
  const isShortPureAlpha = tokens.length === 1 && /^[a-z]{2,6}$/i.test(tokens[0]);
  return isAlnumWithDigit || isShortPureAlpha;
}

// A clean-looking short phrase, even if it doesn't validate as a model —
// this is the "P-series" case: real family signal, not a model number.
function looksSalvageable(candidate: string): boolean {
  if (!candidate) return false;
  if (containsHedgeWord(candidate)) return false;
  if (SENTENCE_PUNCTUATION.test(candidate)) return false;
  const tokens = candidate.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.length <= 3;
}

/**
 * Validates an AI-supplied model_number field. Rejects hedge words ("unknown",
 * "not visible", ...), anything exceeding 3 whitespace-separated tokens, and
 * sentence punctuation. Salvages a rejected-but-clean short phrase (e.g.
 * "P-series") as modelFamilyHint instead of discarding it outright — real
 * family signal a naive reject-everything rule would throw away.
 */
export function parseModelToken(raw: string | null): ModelParseResult {
  if (!raw) return { model: null, modelFamilyHint: null };
  const trimmed = raw.trim();
  if (!trimmed) return { model: null, modelFamilyHint: null };

  const primary = splitPrimarySegment(trimmed);
  if (looksSalvageable(primary) && looksLikeValidatedToken(primary)) {
    return { model: primary, modelFamilyHint: null };
  }
  if (looksSalvageable(primary)) {
    return { model: null, modelFamilyHint: primary.toLowerCase() };
  }
  return { model: null, modelFamilyHint: null };
}

/**
 * Validates an AI-supplied variant field (e.g. "Black 256GB", not "possibly
 * a limited edition"). Same hedge-word/sentence-punctuation/token-count
 * discipline as parseModelToken, but without the digit requirement — a
 * color or size variant legitimately has none.
 */
export function parseVariantToken(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const primary = splitPrimarySegment(trimmed);
  return looksSalvageable(primary) ? primary : null;
}

// Standard barcode digit lengths. 13-digit codes starting 978/979 are
// Bookland EAN-13s — i.e. ISBNs encoded as EAN-13, the form a barcode
// scanner actually reads off a book — so classify those as ISBN rather than
// a generic EAN.
function classifyDigits(digits: string): 'GTIN' | 'UPC' | 'EAN' | 'ISBN' | null {
  switch (digits.length) {
    case 8: return 'UPC';
    case 12: return 'UPC';
    case 13: return /^97[89]/.test(digits) ? 'ISBN' : 'EAN';
    case 14: return 'GTIN';
    default: return null;
  }
}

/**
 * Validates an AI-supplied gtin/barcode field. Accepts only digits (spaces
 * and hyphens stripped as formatting) at a standard GTIN/UPC/EAN/ISBN
 * length — never a prose hedge, never a partial/garbled read coerced into a
 * number. A legible barcode is the strongest identity signal available, so
 * this is deliberately strict: better to fall through to a weaker
 * identifier than to search on a wrong one with false confidence.
 */
export function parseGtinToken(raw: string | null): GtinParseResult {
  if (!raw) return { gtin: null, gtinKind: null };
  const trimmed = raw.trim();
  if (!trimmed || containsHedgeWord(trimmed)) return { gtin: null, gtinKind: null };

  const digitsOnly = trimmed.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digitsOnly)) return { gtin: null, gtinKind: null };

  const gtinKind = classifyDigits(digitsOnly);
  return gtinKind ? { gtin: digitsOnly, gtinKind } : { gtin: null, gtinKind: null };
}
