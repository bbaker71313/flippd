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
  var VALID_DECISION_STATUSES = ['ok', 'insufficient_market_data'];
  var VALID_EVIDENCE_QUALITIES = ['strong', 'moderate', 'weak', 'none'];

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

  // Chapter 02 AI-market-authority fix: the server now returns decision:null
  // whenever verified market evidence was unavailable — no authoritative
  // HOT/LIST/SKIP exists for that scan. null is allowed ONLY here (not for
  // the plain asDecision above, which still guards other required-decision
  // call sites against a silently-missing field).
  function asNullableDecision(v, field) {
    if (v === null || v === undefined) return null;
    return asDecision(v, field);
  }

  function asBoolean(v, field) {
    if (typeof v !== 'boolean') fail(field, 'a boolean', v);
    return v;
  }

  function asDecisionStatus(v, field) {
    if (VALID_DECISION_STATUSES.indexOf(v) === -1) fail(field, "'ok' or 'insufficient_market_data'", v);
    return v;
  }

  // Decision Integrity remediation (Release A): comp-sample-size evidence
  // quality (see marketMetrics.ts computeSoldPriceStats). Nullable — null
  // whenever no verified metrics exist (marketDataSource is 'ai_estimate').
  function asEvidenceQuality(v, field) {
    if (v === null || v === undefined) return null;
    if (VALID_EVIDENCE_QUALITIES.indexOf(v) === -1) fail(field, "'strong'/'moderate'/'weak'/'none' or null", v);
    return v;
  }

  // The deterministic decisionEngine.ts DecisionResult object (decision +
  // each threshold's pass/fail + failingThresholds) — null when no
  // authoritative decision was made (insufficient verified evidence). This
  // replaces a pre-existing contract bug where this field was validated as a
  // plain string array (asStringArray) even though the server has always
  // sent the full DecisionResult object here — that mismatch meant this
  // validator would throw on every single/text scan response once actually
  // exercised end-to-end (never live-verified until this session's fix).
  function asDecisionReasons(v, field) {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'object' || Array.isArray(v)) fail(field, 'a decision-reasons object or null', v);
    return {
      decision: asDecision(v.decision, field + '.decision'),
      profitPass: asBoolean(v.profitPass, field + '.profitPass'),
      roiPass: asBoolean(v.roiPass, field + '.roiPass'),
      strPass: asBoolean(v.strPass, field + '.strPass'),
      daysPass: asBoolean(v.daysPass, field + '.daysPass'),
      demandIsVeryHigh: asBoolean(v.demandIsVeryHigh, field + '.demandIsVeryHigh'),
      // Decision Integrity remediation (Release A): true when a HOT-shaped
      // result (all thresholds passed, demand VERY HIGH) was capped to LIST
      // because the sold-comp sample was too small to trust at HOT authority.
      hotCappedByEvidence: asBoolean(v.hotCappedByEvidence, field + '.hotCappedByEvidence'),
      failingThresholds: asStringArray(v.failingThresholds, field + '.failingThresholds'),
    };
  }

  // Chapter 02: the AI's own price/STR/days/demand guess, kept structurally
  // separate from the authoritative fields above. Present only when
  // decisionStatus is 'insufficient_market_data'; null once verified
  // evidence exists (the AI guess is superseded, not merged with it).
  function asAiEstimate(v, field) {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'object' || Array.isArray(v)) fail(field, 'an AI-estimate object or null', v);
    return {
      avg_sold_price: asNullableNumber(v.avgSoldPrice, field + '.avgSoldPrice'),
      price_low: asNullableNumber(v.priceLow, field + '.priceLow'),
      price_high: asNullableNumber(v.priceHigh, field + '.priceHigh'),
      sell_through_rate: asNullableNumber(v.sellThroughRate, field + '.sellThroughRate'),
      avg_days_to_sell: asNullableNumber(v.avgDaysToSell, field + '.avgDaysToSell'),
      demand_level: asDemandLevel(v.demandLevel, field + '.demandLevel'),
    };
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
    // Chapter 02 fix: decision is null exactly when verified market evidence
    // was unavailable (decisionAvailable:false) — never a fabricated
    // HOT/LIST/SKIP built from the AI's own market estimate.
    var decisionAvailable = asBoolean(r.decisionAvailable, 'decisionAvailable');
    var decisionStatus = asDecisionStatus(r.decisionStatus, 'decisionStatus');
    var dec = asNullableDecision(r.decision, 'decision');
    if (decisionAvailable && dec === null) fail('decision', 'a real decision when decisionAvailable is true', dec);
    if (!decisionAvailable && dec !== null) fail('decision', 'null when decisionAvailable is false', dec);

    var profit = asNullableNumber(r.estimatedProfit, 'estimatedProfit');
    var fee = asNullableNumber(r.feeAmount, 'feeAmount');
    var shipCost = asNullableNumber(r.shipCostAmount, 'shipCostAmount');
    if (decisionAvailable && (profit === null || fee === null || shipCost === null)) {
      fail('estimatedProfit/feeAmount/shipCostAmount', 'finite numbers when decisionAvailable is true', { profit: profit, fee: fee, shipCost: shipCost });
    }
    var fin = {
      profit: profit,
      roi: asNullableNumber(r.roi, 'roi'), // null = $0 acquisition cost (P2-31) or unavailable — never coerce to 0
      fee: fee,
      shipCost: shipCost,
    };
    return {
      item: item,
      dec: dec,
      fin: fin,
      cost: asNullableNumber(r.acquisitionCost, 'acquisitionCost'),
      maxBuyPrice: asNullableNumber(r.maxBuyPrice, 'maxBuyPrice'),
      maxBuyPriceLimitedBy: asString(r.maxBuyPriceLimitedBy, 'maxBuyPriceLimitedBy', null),
      marketDataSource: asString(r.marketDataSource, 'marketDataSource', null),
      decisionAvailable: decisionAvailable,
      decisionStatus: decisionStatus,
      decisionReasons: asDecisionReasons(r.decisionReasons, 'decisionReasons'),
      aiEstimate: asAiEstimate(r.aiEstimate, 'aiEstimate'),
      evidenceQuality: asEvidenceQuality(r.evidenceQuality, 'evidenceQuality'),
      compMatchPrecision: asString(r.compMatchPrecision, 'compMatchPrecision', null),
    };
  }

  // One item within claude-proxy's shelf_scan response. Every shelf item is
  // pre-purchase (no acquisition cost yet), so unlike normalizeSingleScanResult
  // there is no `fin`/`cost` here — only the server's deterministic
  // backward-solved maxBuyPrice.
  function normalizeShelfScanItem(i) {
    if (!i || typeof i !== 'object') fail('shelf scan item', 'an object', i);
    var decisionAvailable = asBoolean(i.decisionAvailable, 'decisionAvailable');
    var decisionStatus = asDecisionStatus(i.decisionStatus, 'decisionStatus');
    var decision = asNullableDecision(i.decision, 'decision');
    if (decisionAvailable && decision === null) fail('decision', 'a real decision when decisionAvailable is true', decision);
    if (!decisionAvailable && decision !== null) fail('decision', 'null when decisionAvailable is false', decision);
    return {
      item_name: asString(i.itemName, 'itemName', ''),
      avg_sold_price: asNullableNumber(i.avgSoldPrice, 'avgSoldPrice'),
      max_buy_price: asNullableNumber(i.maxBuyPrice, 'maxBuyPrice'),
      max_buy_price_limited_by: asString(i.maxBuyPriceLimitedBy, 'maxBuyPriceLimitedBy', null),
      demand_level: asDemandLevel(i.demandLevel, 'demandLevel'),
      decision: decision,
      decision_reason: asString(i.notes, 'notes', ''),
      condition_notes: asString(i.conditionNotes, 'conditionNotes', ''),
      category: asString(i.category, 'category', null),
      confidence: asNullableNumber(i.confidence, 'confidence'),
      sell_through_rate: asNullableNumber(i.sellThroughRate, 'sellThroughRate'),
      avg_days_to_sell: asNullableNumber(i.avgDaysToSell, 'avgDaysToSell'),
      market_data_source: asString(i.marketDataSource, 'marketDataSource', null),
      decision_available: decisionAvailable,
      decision_status: decisionStatus,
      decision_reasons: asDecisionReasons(i.decisionReasons, 'decisionReasons'),
      ai_estimate: asAiEstimate(i.aiEstimate, 'aiEstimate'),
      evidence_quality: asEvidenceQuality(i.evidenceQuality, 'evidenceQuality'),
      comp_match_precision: asString(i.compMatchPrecision, 'compMatchPrecision', null),
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
