// P3-39/P3-40: typed contract + runtime validation for claude-proxy's scan
// response shapes, extracted from analyze()/analyzeShelf()'s previously
// inline, unvalidated field mapping in app.html.
//
// Why a plain .js file loaded via <script src="..."> instead of a real
// TypeScript import: app.html has no build step (CLAUDE.md/ARCHITECTURE.md
// — vanilla HTML/CSS/JS, no bundler), so it cannot literally import a .ts
// module. This file is the smallest architecture-compatible way to get a
// real typed *contract* (documented shape + runtime-enforced invariants)
// between the server response and the UI, without inventing a bundler or
// rewriting the frontend (P3-39's explicit fallback: "use runtime
// validation / narrow adapters / explicit schemas rather than pretending
// untyped objects are safe" where full TS consumption isn't practical yet).
//
// Design:
// - Pure functions only — no DOM, no network, no globals mutated. Fully
//   unit-testable with `node --test` independent of a browser.
// - Fails honestly (throws) on a malformed *required* field (a decision
//   that isn't HOT/LIST/SKIP, a profit that isn't a finite number) rather
//   than silently rendering a wrong or fabricated business result — per
//   CLAUDE.md's Anti-Drift Contract rule 6 (no silent fallbacks).
// - Distinguishes fields that are legitimately nullable by business
//   semantics (roi — null means $0 acquisition cost, not "unknown"; market
//   evidence fields — null means unverified/unavailable, see
//   packages/shared/src/utils/marketMetrics.ts) from fields that must
//   always be a real number (net profit, fees, shipping cost — calcProfit.ts
//   never returns these as null). A field silently arriving as `undefined`
//   from a malformed response is treated the same as genuinely missing for
//   nullable fields (→ null, never fabricated), but is a hard error for
//   required fields.

(function (global) {
  'use strict';

  var VALID_DECISIONS = ['HOT', 'LIST', 'SKIP'];
  var VALID_DEMAND_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'VERY HIGH'];

  function fail(field, expected, value) {
    throw new Error('scanResultContract: ' + field + ' must be ' + expected + ', got ' + JSON.stringify(value));
  }

  // Required: must be present and a finite number. Never coerces a string,
  // never treats NaN/Infinity as valid — those are exactly the "implicit
  // numeric coercion" bugs this contract exists to catch.
  function asNumber(v, field) {
    if (typeof v !== 'number' || !Number.isFinite(v)) fail(field, 'a finite number', v);
    return v;
  }

  // Nullable: null/undefined both normalize to null (missing evidence is
  // never fabricated as 0 or any other value); a *present* value must still
  // be a real finite number.
  function asNullableNumber(v, field) {
    if (v === null || v === undefined) return null;
    return asNumber(v, field);
  }

  function asString(v, field, fallback) {
    if (v === null || v === undefined) return fallback === undefined ? null : fallback;
    if (typeof v !== 'string') fail(field, 'a string', v);
    return v;
  }

  function asStringArray(v, field) {
    if (v === null || v === undefined) return [];
    if (!Array.isArray(v)) fail(field, 'an array', v);
    return v;
  }

  function asDecision(v, field) {
    if (VALID_DECISIONS.indexOf(v) === -1) fail(field, 'one of HOT/LIST/SKIP', v);
    return v;
  }

  // Demand level is nullable (unverified market evidence — see DECISIONS.md
  // P0 rules) but a *present* value must be one of the four real levels.
  function asDemandLevel(v, field) {
    if (v === null || v === undefined) return null;
    if (VALID_DEMAND_LEVELS.indexOf(v) === -1) fail(field, 'a valid demand level or null', v);
    return v;
  }

  // claude-proxy's single_scan/text_scan response → the snake_case `item`
  // shape renderSingle() consumes, plus the decision/financial fields.
  function normalizeSingleScanResult(r) {
    if (!r || typeof r !== 'object') fail('single scan result', 'an object', r);
    var item = {
      item_name: asString(r.itemName, 'itemName', ''),
      avg_sold_price: asNullableNumber(r.estimatedSell, 'estimatedSell'),
      price_low: asNullableNumber(r.priceLow, 'priceLow'),
      price_high: asNullableNumber(r.priceHigh, 'priceHigh'),
      sell_through_rate: asNullableNumber(r.sellThroughRate, 'sellThroughRate'),
      avg_days_to_sell: asNullableNumber(r.avgDaysToSell, 'avgDaysToSell'),
      demand_level: asDemandLevel(r.demandLevel, 'demandLevel'),
      confidence: asNullableNumber(r.confidence, 'confidence'),
      confidence_reason: asString(r.reasoning, 'reasoning', ''),
      search_keywords: asStringArray(r.searchKeywords, 'searchKeywords'),
      listing_tips: asStringArray(r.listingTips, 'listingTips'),
      risk_flags: asStringArray(r.riskFlags, 'riskFlags'),
      condition_notes: asString(r.conditionNotes, 'conditionNotes', ''),
      category: asString(r.category, 'category', null),
      brand: asString(r.brand, 'brand', null),
      notes: asString(r.notes, 'notes', ''),
    };
    var dec = asDecision(r.decision, 'decision');
    var fin = {
      profit: asNumber(r.estimatedProfit, 'estimatedProfit'),
      roi: asNullableNumber(r.roi, 'roi'), // null = $0 acquisition cost (P2-31) — never coerce to 0
      fee: asNumber(r.feeAmount, 'feeAmount'),
      shipCost: asNumber(r.shipCostAmount, 'shipCostAmount'),
    };
    return {
      item: item,
      dec: dec,
      fin: fin,
      cost: asNullableNumber(r.acquisitionCost, 'acquisitionCost'),
      maxBuyPrice: asNullableNumber(r.maxBuyPrice, 'maxBuyPrice'),
      maxBuyPriceLimitedBy: asString(r.maxBuyPriceLimitedBy, 'maxBuyPriceLimitedBy', null),
      marketDataSource: asString(r.marketDataSource, 'marketDataSource', null),
      decisionReasons: asStringArray(r.decisionReasons, 'decisionReasons'),
    };
  }

  // One item within claude-proxy's shelf_scan response. Every shelf item is
  // pre-purchase (no acquisition cost yet), so unlike normalizeSingleScanResult
  // there is no `fin`/`cost` here — only the server's deterministic
  // backward-solved maxBuyPrice.
  function normalizeShelfScanItem(i) {
    if (!i || typeof i !== 'object') fail('shelf scan item', 'an object', i);
    return {
      item_name: asString(i.itemName, 'itemName', ''),
      avg_sold_price: asNullableNumber(i.avgSoldPrice, 'avgSoldPrice'),
      max_buy_price: asNullableNumber(i.maxBuyPrice, 'maxBuyPrice'),
      max_buy_price_limited_by: asString(i.maxBuyPriceLimitedBy, 'maxBuyPriceLimitedBy', null),
      demand_level: asDemandLevel(i.demandLevel, 'demandLevel'),
      decision: asDecision(i.decision, 'decision'),
      decision_reason: asString(i.notes, 'notes', ''),
      condition_notes: asString(i.conditionNotes, 'conditionNotes', ''),
      category: asString(i.category, 'category', null),
      confidence: asNullableNumber(i.confidence, 'confidence'),
      sell_through_rate: asNullableNumber(i.sellThroughRate, 'sellThroughRate'),
      avg_days_to_sell: asNullableNumber(i.avgDaysToSell, 'avgDaysToSell'),
      market_data_source: asString(i.marketDataSource, 'marketDataSource', null),
      decision_reasons: asStringArray(i.decisionReasons, 'decisionReasons'),
    };
  }

  function normalizeShelfScanResult(r) {
    if (!r || typeof r !== 'object') fail('shelf scan result', 'an object', r);
    var rawItems = r.items;
    if (rawItems === null || rawItems === undefined) rawItems = [];
    if (!Array.isArray(rawItems)) fail('items', 'an array', rawItems);
    return rawItems.map(normalizeShelfScanItem);
  }

  var ScanResultContract = {
    normalizeSingleScanResult: normalizeSingleScanResult,
    normalizeShelfScanResult: normalizeShelfScanResult,
    normalizeShelfScanItem: normalizeShelfScanItem,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScanResultContract;
  } else {
    global.ScanResultContract = ScanResultContract;
  }
})(typeof window !== 'undefined' ? window : globalThis);
