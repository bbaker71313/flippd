// Tests for calcProfit — the single source of profit math (CLAUDE.md §Business Logic).
// Runner: Node built-in test runner with type stripping — `node --test calcProfit.test.ts`.
// No live Supabase/Stripe — pure function, deterministic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcProfit } from './calcProfit.ts';

test('happy path — standard flip with default fee 13%', () => {
  const r = calcProfit({ sellPrice: 100, cost: 20, pkgCost: 1.25, shipCost: 6, ebayFee: 13 });
  assert.equal(r.gross, 100);
  assert.equal(r.ebayFees, 13);      // 100 * 0.13
  assert.equal(r.totalFees, 20.25);  // 1.25 + 6 + 13
  assert.equal(r.net, 59.75);        // 100 - (20 + 20.25)
  assert.equal(r.roi, 298.75);       // 59.75 / 20 * 100
  assert.equal(r.margin, 59.75);     // 59.75 / 100 * 100
});

test('ebayFee is configurable — fee 0 produces zero eBay fees (never hardcoded)', () => {
  const r = calcProfit({ sellPrice: 100, cost: 20, pkgCost: 1.25, shipCost: 6, ebayFee: 0 });
  assert.equal(r.ebayFees, 0);
  assert.equal(r.totalFees, 7.25);   // 1.25 + 6 + 0
  assert.equal(r.net, 72.75);        // 100 - (20 + 7.25)
});

test('edge — zero cost: roi is null (undefined ratio, not 0%)', () => {
  const r = calcProfit({ sellPrice: 50, cost: 0, pkgCost: 1.25, shipCost: 6, ebayFee: 13 });
  assert.equal(r.ebayFees, 6.5);
  assert.equal(r.net, 36.25);        // 50 - (0 + 7.25 + 6.5... ) => 50 - 13.75
  assert.equal(r.roi, null);         // cost not > 0 — never fabricate a 0% return
  assert.equal(r.margin, 72.5);      // 36.25 / 50 * 100
});

test('invalid input — negative sellPrice throws', () => {
  assert.throws(() => calcProfit({ sellPrice: -1, cost: 10, pkgCost: 0, shipCost: 0, ebayFee: 13 }));
});

test('invalid input — negative cost throws', () => {
  assert.throws(() => calcProfit({ sellPrice: 50, cost: -1, pkgCost: 0, shipCost: 0, ebayFee: 13 }));
});

test('invalid input — negative ebayFee throws', () => {
  assert.throws(() => calcProfit({ sellPrice: 50, cost: 10, pkgCost: 0, shipCost: 0, ebayFee: -1 }));
});

test('invalid input — non-finite number throws', () => {
  assert.throws(() => calcProfit({ sellPrice: NaN, cost: 10, pkgCost: 0, shipCost: 0, ebayFee: 13 }));
  assert.throws(() => calcProfit({ sellPrice: Infinity, cost: 10, pkgCost: 0, shipCost: 0, ebayFee: 13 }));
});

test('edge — zero sellPrice: margin guarded to 0', () => {
  const r = calcProfit({ sellPrice: 0, cost: 10, pkgCost: 1.25, shipCost: 6, ebayFee: 13 });
  assert.equal(r.ebayFees, 0);
  assert.equal(r.net, -17.25);       // 0 - (10 + 7.25)
  assert.equal(r.roi, -172.5);       // -17.25 / 10 * 100
  assert.equal(r.margin, 0);         // sellPrice not > 0
});

test('failure — negative profit when sell below cost+fees', () => {
  const r = calcProfit({ sellPrice: 10, cost: 20, pkgCost: 1.25, shipCost: 6, ebayFee: 13 });
  assert.equal(r.ebayFees, 1.3);
  assert.equal(r.net, -18.55);       // 10 - (20 + 1.25 + 6 + 1.3)
  assert.ok(r.net < 0);
  assert.equal(r.roi, -92.75);
  assert.equal(r.margin, -185.5);
});

test('currency rounding — results rounded to 2 decimals', () => {
  const r = calcProfit({ sellPrice: 33.33, cost: 10, pkgCost: 0, shipCost: 0, ebayFee: 13 });
  assert.equal(r.ebayFees, 4.33);    // 33.33 * 0.13 = 4.3329 -> 4.33
  // net = 33.33 - (10 + 4.3329) = 18.9971 -> 19
  assert.equal(r.net, 19);
});
