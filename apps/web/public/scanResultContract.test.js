// Run: node --test apps/web/public/scanResultContract.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSingleScanResult, normalizeShelfScanResult, normalizeShelfScanItem } = require('./scanResultContract.js');

function decisionReasonsFor(decision, overrides) {
  return Object.assign({
    decision: decision, profitPass: true, roiPass: true, strPass: true, daysPass: true,
    demandIsVeryHigh: decision === 'HOT', hotCappedByEvidence: false, failingThresholds: [],
  }, overrides || {});
}

function baseSingleScan(overrides) {
  return Object.assign({
    itemName: 'Minolta X-700 35mm SLR Film Camera',
    estimatedSell: 85, priceLow: 60, priceHigh: 110,
    sellThroughRate: 62, avgDaysToSell: 21,
    demandLevel: 'HIGH', confidence: 80, reasoning: 'confirmed via label',
    searchKeywords: ['minolta x-700'], listingTips: ['tip'], riskFlags: [],
    conditionNotes: 'light wear', category: 'Cameras', brand: 'Minolta', notes: '',
    decision: 'LIST',
    estimatedProfit: 42.5, roi: 298.75, feeAmount: 13, shipCostAmount: 6,
    acquisitionCost: 20, maxBuyPrice: null, maxBuyPriceLimitedBy: null,
    marketDataSource: 'verified', decisionAvailable: true, decisionStatus: 'ok',
    decisionReasons: decisionReasonsFor('LIST'), aiEstimate: null,
    evidenceQuality: 'strong', compMatchPrecision: 'exact_model',
  }, overrides || {});
}

// A scan where verified market evidence was unavailable — every authoritative
// field is null/decisionAvailable:false, with the AI's own guess carried only
// informationally in aiEstimate. Mirrors what claude-proxy's
// resolveScanResultCore() actually returns on the unverified path.
function insufficientEvidenceSingleScan(overrides) {
  return Object.assign({
    itemName: 'Minolta X-700 35mm SLR Film Camera',
    estimatedSell: null, priceLow: null, priceHigh: null,
    sellThroughRate: null, avgDaysToSell: null, demandLevel: null,
    confidence: 55, reasoning: 'low confidence — no verified comps found',
    searchKeywords: [], listingTips: [], riskFlags: [],
    conditionNotes: '', category: 'Cameras', brand: 'Minolta', notes: '',
    decision: null,
    estimatedProfit: null, roi: null, feeAmount: null, shipCostAmount: null,
    acquisitionCost: 20, maxBuyPrice: null, maxBuyPriceLimitedBy: null,
    marketDataSource: 'ai_estimate', decisionAvailable: false, decisionStatus: 'insufficient_market_data',
    decisionReasons: null,
    aiEstimate: {
      avgSoldPrice: 100, priceLow: 80, priceHigh: 120,
      sellThroughRate: 90, avgDaysToSell: 5, demandLevel: 'VERY HIGH',
    },
    evidenceQuality: null, compMatchPrecision: null,
  }, overrides || {});
}

test('normalizeSingleScanResult: happy path maps camelCase -> snake_case item shape', () => {
  const out = normalizeSingleScanResult(baseSingleScan());
  assert.equal(out.item.item_name, 'Minolta X-700 35mm SLR Film Camera');
  assert.equal(out.item.avg_sold_price, 85);
  assert.equal(out.item.demand_level, 'HIGH');
  assert.equal(out.dec, 'LIST');
  assert.equal(out.fin.profit, 42.5);
  assert.equal(out.fin.roi, 298.75);
});

test('normalizeSingleScanResult: null roi (zero acquisition cost) is preserved, never coerced to 0', () => {
  const out = normalizeSingleScanResult(baseSingleScan({ roi: null, acquisitionCost: 0 }));
  assert.equal(out.fin.roi, null);
  assert.equal(out.cost, 0);
});

test('normalizeSingleScanResult: undefined roi (malformed/missing) also normalizes to null, not fabricated', () => {
  const raw = baseSingleScan();
  delete raw.roi;
  const out = normalizeSingleScanResult(raw);
  assert.equal(out.fin.roi, null);
});

test('normalizeSingleScanResult: missing required decision throws rather than rendering garbage', () => {
  const raw = baseSingleScan({ decision: 'MAYBE' });
  assert.throws(() => normalizeSingleScanResult(raw), /decision/);
});

test('normalizeSingleScanResult: missing required estimatedProfit throws (never null/undefined silently)', () => {
  const raw = baseSingleScan();
  delete raw.estimatedProfit;
  assert.throws(() => normalizeSingleScanResult(raw), /estimatedProfit/);
});

test('normalizeSingleScanResult: NaN/Infinity in a numeric field throws (implicit-coercion guard)', () => {
  assert.throws(() => normalizeSingleScanResult(baseSingleScan({ estimatedProfit: NaN })), /estimatedProfit/);
  assert.throws(() => normalizeSingleScanResult(baseSingleScan({ priceHigh: Infinity })), /priceHigh/);
});

test('normalizeSingleScanResult: invalid demandLevel throws; null demandLevel is allowed (unverified evidence)', () => {
  assert.throws(() => normalizeSingleScanResult(baseSingleScan({ demandLevel: 'EXTREME' })), /demandLevel/);
  const out = normalizeSingleScanResult(baseSingleScan({ demandLevel: null }));
  assert.equal(out.item.demand_level, null);
});

test('normalizeSingleScanResult: null market evidence fields stay null (never fabricated)', () => {
  const out = normalizeSingleScanResult(baseSingleScan({
    estimatedSell: null, priceLow: null, priceHigh: null,
    sellThroughRate: null, avgDaysToSell: null, demandLevel: null,
  }));
  assert.equal(out.item.avg_sold_price, null);
  assert.equal(out.item.sell_through_rate, null);
  assert.equal(out.item.demand_level, null);
});

test('normalizeSingleScanResult: throws on a non-object input', () => {
  assert.throws(() => normalizeSingleScanResult(null));
  assert.throws(() => normalizeSingleScanResult('not an object'));
});

function baseShelfItem(overrides) {
  return Object.assign({
    itemName: 'Vintage Levi Jacket', avgSoldPrice: 45,
    maxBuyPrice: 12, maxBuyPriceLimitedBy: 'minProfit',
    demandLevel: 'VERY HIGH', decision: 'HOT', notes: 'strong comps',
    conditionNotes: '', category: 'Clothing', confidence: 70,
    sellThroughRate: 75, avgDaysToSell: 10,
    marketDataSource: 'verified', decisionAvailable: true, decisionStatus: 'ok',
    decisionReasons: decisionReasonsFor('HOT'), aiEstimate: null,
    evidenceQuality: 'strong', compMatchPrecision: 'exact_model',
  }, overrides || {});
}

// Mirrors an unverified shelf item — see insufficientEvidenceSingleScan above.
function insufficientEvidenceShelfItem(overrides) {
  return Object.assign({
    itemName: 'Unmarked Ceramic Vase', avgSoldPrice: null,
    maxBuyPrice: null, maxBuyPriceLimitedBy: null,
    demandLevel: null, decision: null, notes: '',
    conditionNotes: '', category: 'Collectibles', confidence: 45,
    sellThroughRate: null, avgDaysToSell: null,
    marketDataSource: 'ai_estimate', decisionAvailable: false, decisionStatus: 'insufficient_market_data',
    decisionReasons: null,
    aiEstimate: { avgSoldPrice: 30, priceLow: 20, priceHigh: 45, sellThroughRate: 80, avgDaysToSell: 8, demandLevel: 'HIGH' },
    evidenceQuality: null, compMatchPrecision: null,
  }, overrides || {});
}

test('normalizeShelfScanResult: maps every item and defaults missing items array to empty', () => {
  const out1 = normalizeShelfScanResult({ items: [baseShelfItem(), baseShelfItem({ decision: 'SKIP', demandLevel: null })] });
  assert.equal(out1.length, 2);
  assert.equal(out1[0].decision, 'HOT');
  assert.equal(out1[1].decision, 'SKIP');

  const out2 = normalizeShelfScanResult({});
  assert.deepEqual(out2, []);
});

test('normalizeShelfScanItem: invalid decision throws, never defaults to SKIP silently', () => {
  assert.throws(() => normalizeShelfScanItem(baseShelfItem({ decision: '' })), /decision/);
});

test('normalizeShelfScanResult: throws if items is present but not an array', () => {
  assert.throws(() => normalizeShelfScanResult({ items: 'not-an-array' }), /items/);
});

// ── Chapter 02 AI-market-authority fix: decisionAvailable / insufficient-evidence state ──

test('normalizeSingleScanResult: verified scan (decisionAvailable:true) accepted with real decisionReasons object', () => {
  const out = normalizeSingleScanResult(baseSingleScan());
  assert.equal(out.decisionAvailable, true);
  assert.equal(out.decisionStatus, 'ok');
  assert.equal(out.dec, 'LIST');
  assert.deepEqual(out.decisionReasons.failingThresholds, []);
  assert.equal(out.aiEstimate, null);
});

test('normalizeSingleScanResult: insufficient-evidence scan is a valid, distinct result shape', () => {
  const out = normalizeSingleScanResult(insufficientEvidenceSingleScan());
  assert.equal(out.decisionAvailable, false);
  assert.equal(out.decisionStatus, 'insufficient_market_data');
  assert.equal(out.dec, null);
  assert.equal(out.fin.profit, null);
  assert.equal(out.fin.roi, null);
  assert.equal(out.maxBuyPrice, null);
  assert.equal(out.decisionReasons, null);
  // AI's own guess survives, but only informationally and separately.
  assert.equal(out.aiEstimate.avg_sold_price, 100);
  assert.equal(out.aiEstimate.demand_level, 'VERY HIGH');
  assert.equal(out.item.avg_sold_price, null); // never merged into the authoritative item fields
});

test('normalizeSingleScanResult: rejects decisionAvailable:true with a null decision (malformed combination)', () => {
  assert.throws(() => normalizeSingleScanResult(baseSingleScan({ decision: null })), /decision/);
});

test('normalizeSingleScanResult: rejects decisionAvailable:false with a non-null decision (malformed combination)', () => {
  assert.throws(() => normalizeSingleScanResult(insufficientEvidenceSingleScan({ decision: 'SKIP' })), /decision/);
});

test('normalizeSingleScanResult: rejects decisionAvailable:true with a null estimatedProfit (never a silent gap in authoritative economics)', () => {
  assert.throws(() => normalizeSingleScanResult(baseSingleScan({ estimatedProfit: null })), /estimatedProfit/);
});

test('normalizeSingleScanResult: rejects an unrecognized decisionStatus', () => {
  assert.throws(() => normalizeSingleScanResult(baseSingleScan({ decisionStatus: 'unknown_status' })), /decisionStatus/);
});

test('normalizeSingleScanResult: rejects a decisionReasons that is not the DecisionResult shape (e.g. a bare array)', () => {
  assert.throws(() => normalizeSingleScanResult(baseSingleScan({ decisionReasons: [] })), /decisionReasons/);
});

test('normalizeShelfScanResult: verified and insufficient-evidence items coexist correctly in one mixed shelf response', () => {
  const out = normalizeShelfScanResult({
    items: [baseShelfItem(), insufficientEvidenceShelfItem(), baseShelfItem({ decision: 'SKIP', decisionReasons: decisionReasonsFor('SKIP') })],
  });
  assert.equal(out.length, 3);
  assert.equal(out[0].decision, 'HOT');
  assert.equal(out[0].decision_available, true);
  assert.equal(out[1].decision, null);
  assert.equal(out[1].decision_available, false);
  assert.equal(out[1].decision_status, 'insufficient_market_data');
  assert.equal(out[1].ai_estimate.demand_level, 'HIGH');
  assert.equal(out[2].decision, 'SKIP');
});

test('normalizeShelfScanItem: rejects decisionAvailable:false with a non-null decision', () => {
  assert.throws(() => normalizeShelfScanItem(insufficientEvidenceShelfItem({ decision: 'LIST' })), /decision/);
});

// ── Decision Integrity remediation (Release A): evidenceQuality / compMatchPrecision / hotCappedByEvidence ──

test('normalizeSingleScanResult: evidenceQuality and compMatchPrecision pass through on the verified path', () => {
  const out = normalizeSingleScanResult(baseSingleScan());
  assert.equal(out.evidenceQuality, 'strong');
  assert.equal(out.compMatchPrecision, 'exact_model');
});

test('normalizeSingleScanResult: evidenceQuality and compMatchPrecision are null on the unverified path', () => {
  const out = normalizeSingleScanResult(insufficientEvidenceSingleScan());
  assert.equal(out.evidenceQuality, null);
  assert.equal(out.compMatchPrecision, null);
});

test('normalizeSingleScanResult: rejects an unrecognized evidenceQuality value', () => {
  assert.throws(() => normalizeSingleScanResult(baseSingleScan({ evidenceQuality: 'super-strong' })), /evidenceQuality/);
});

test('normalizeSingleScanResult: a HOT-shaped result capped to LIST by weak evidence carries hotCappedByEvidence:true', () => {
  const out = normalizeSingleScanResult(baseSingleScan({
    decision: 'LIST',
    decisionReasons: decisionReasonsFor('LIST', { demandIsVeryHigh: true, hotCappedByEvidence: true }),
    evidenceQuality: 'weak',
  }));
  assert.equal(out.dec, 'LIST');
  assert.equal(out.decisionReasons.hotCappedByEvidence, true);
  assert.equal(out.decisionReasons.demandIsVeryHigh, true);
  assert.equal(out.evidenceQuality, 'weak');
});

test('normalizeShelfScanItem: evidence_quality/comp_match_precision map to snake_case', () => {
  const out = normalizeShelfScanItem(baseShelfItem());
  assert.equal(out.evidence_quality, 'strong');
  assert.equal(out.comp_match_precision, 'exact_model');
  const unverified = normalizeShelfScanItem(insufficientEvidenceShelfItem());
  assert.equal(unverified.evidence_quality, null);
  assert.equal(unverified.comp_match_precision, null);
});
