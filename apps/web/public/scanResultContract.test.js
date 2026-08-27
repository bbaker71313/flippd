// Run: node --test apps/web/public/scanResultContract.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSingleScanResult, normalizeShelfScanResult, normalizeShelfScanItem } = require('./scanResultContract.js');

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
    marketDataSource: 'verified', decisionReasons: [],
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
    marketDataSource: 'verified', decisionReasons: [],
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
