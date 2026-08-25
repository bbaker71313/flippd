// Tests for the "acquisition cost unknown" backward-solve — never invent a
// purchase cost from sale price (e.g. avgSoldPrice * 0.10). Instead compute
// the highest price that still clears the user's configured thresholds.
// Runner: `node --test maxBuyPrice.test.ts`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcMaxBuyPrice } from './maxBuyPrice.ts';

test('min-profit constraint is limiting (high minProfit, low targetRoi)', () => {
  const r = calcMaxBuyPrice({ sellPrice: 100, ebayFee: 13, pkgCost: 1.25, shipCost: 0, minProfit: 50, targetRoi: 10 });
  // grossAfterFees = 100 - 1.25 - 13 = 85.75; costForMinProfit = 35.75; costForTargetRoi = 77.95
  assert.equal(r.maxCost, 35.75);
  assert.equal(r.limitedBy, 'minProfit');
});

test('ROI constraint is limiting (low minProfit, high targetRoi)', () => {
  const r = calcMaxBuyPrice({ sellPrice: 100, ebayFee: 13, pkgCost: 1.25, shipCost: 0, minProfit: 5, targetRoi: 200 });
  // grossAfterFees = 85.75; costForMinProfit = 80.75; costForTargetRoi = 85.75/3 = 28.58333
  assert.equal(r.maxCost, 28.58);
  assert.equal(r.limitedBy, 'targetRoi');
});

test('both constraints equal', () => {
  const r = calcMaxBuyPrice({ sellPrice: 100, ebayFee: 0, pkgCost: 0, shipCost: 0, minProfit: 50, targetRoi: 100 });
  // grossAfterFees = 100; costForMinProfit = 50; costForTargetRoi = 100/2 = 50
  assert.equal(r.maxCost, 50);
  assert.equal(r.limitedBy, 'both');
});

test('very low sale price -> no positive cost qualifies', () => {
  const r = calcMaxBuyPrice({ sellPrice: 5, ebayFee: 13, pkgCost: 1.25, shipCost: 6, minProfit: 15, targetRoi: 200 });
  assert.equal(r.maxCost, null);
  assert.equal(r.limitedBy, 'none');
});

test('high fees reduce the qualifying max cost', () => {
  const r = calcMaxBuyPrice({ sellPrice: 50, ebayFee: 40, pkgCost: 1.25, shipCost: 0, minProfit: 5, targetRoi: 50 });
  // grossAfterFees = 50 - 1.25 - 20 = 28.75; costForMinProfit = 23.75; costForTargetRoi = 28.75/1.5 = 19.16667
  assert.equal(r.maxCost, 19.17);
  assert.equal(r.limitedBy, 'targetRoi');
});

test('seller-paid shipping cost lowers the qualifying max cost vs buyer-paid', () => {
  const buyerPaid = calcMaxBuyPrice({ sellPrice: 100, ebayFee: 13, pkgCost: 1.25, shipCost: 0, minProfit: 15, targetRoi: 100 });
  const sellerPaid = calcMaxBuyPrice({ sellPrice: 100, ebayFee: 13, pkgCost: 1.25, shipCost: 8, minProfit: 15, targetRoi: 100 });
  assert.ok((sellerPaid.maxCost ?? 0) < (buyerPaid.maxCost ?? 0));
});

test('impossible profitable case -> null, not a misleading buy price', () => {
  const r = calcMaxBuyPrice({ sellPrice: 10, ebayFee: 13, pkgCost: 1.25, shipCost: 6, minProfit: 15, targetRoi: 200 });
  assert.equal(r.maxCost, null);
  assert.equal(r.limitedBy, 'none');
});

test('invalid input — negative sellPrice throws', () => {
  assert.throws(() => calcMaxBuyPrice({ sellPrice: -1, ebayFee: 13, pkgCost: 0, shipCost: 0, minProfit: 15, targetRoi: 200 }));
});
