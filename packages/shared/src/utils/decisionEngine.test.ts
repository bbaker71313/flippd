// Boundary tests for the authoritative HOT/LIST/SKIP decision engine.
// Runner: `node --test decisionEngine.test.ts` (type-stripped, no live services).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from './decisionEngine.ts';
import type { DecisionInputs } from '../types/index.ts';

const BASE: DecisionInputs = {
  netProfit: 100,
  roi: 250,
  sellThroughRate: 60,
  daysToSell: 20,
  demandLevel: 'VERY HIGH',
  minProfit: 15,
  targetRoi: 200,
  minSellThroughRate: 30,
  maxDaysToSell: 60,
};

test('all thresholds passing + VERY HIGH demand -> HOT', () => {
  const r = decide(BASE);
  assert.equal(r.decision, 'HOT');
  assert.equal(r.failingThresholds.length, 0);
});

test('all thresholds passing but HIGH demand -> LIST, not HOT', () => {
  const r = decide({ ...BASE, demandLevel: 'HIGH' });
  assert.equal(r.decision, 'LIST');
});

test('demand alone never triggers HOT — thresholds still required', () => {
  const r = decide({ ...BASE, netProfit: 5, demandLevel: 'VERY HIGH' });
  assert.equal(r.decision, 'SKIP');
  assert.ok(r.failingThresholds.includes('profit'));
});

test('profit exactly equal to minProfit passes', () => {
  const r = decide({ ...BASE, netProfit: 15, minProfit: 15 });
  assert.equal(r.profitPass, true);
});

test('profit one cent below minProfit fails -> SKIP', () => {
  const r = decide({ ...BASE, netProfit: 14.99, minProfit: 15 });
  assert.equal(r.profitPass, false);
  assert.equal(r.decision, 'SKIP');
});

test('roi exactly equal to targetRoi passes', () => {
  const r = decide({ ...BASE, roi: 200, targetRoi: 200 });
  assert.equal(r.roiPass, true);
});

test('roi slightly below targetRoi fails -> SKIP', () => {
  const r = decide({ ...BASE, roi: 199.99, targetRoi: 200 });
  assert.equal(r.roiPass, false);
  assert.equal(r.decision, 'SKIP');
});

// Zero-cost ROI correction (2026-08-26): a genuine $0 acquisition cost makes
// roi null (see calcProfit). null roi must bypass the ROI threshold, not
// fail it — a free item is not penalized just because % ROI is undefined.
test('roi null ($0 acquisition cost) bypasses the ROI threshold — not an automatic SKIP', () => {
  const r = decide({ ...BASE, roi: null });
  assert.equal(r.roiPass, true);
  assert.equal(r.decision, 'HOT');
});

test('$0-cost item passing every other required threshold qualifies as HOT', () => {
  const r = decide({ ...BASE, roi: null, demandLevel: 'VERY HIGH' });
  assert.equal(r.decision, 'HOT');
  assert.equal(r.failingThresholds.length, 0);
});

test('$0-cost item still SKIPs when another required threshold fails', () => {
  const r = decide({ ...BASE, roi: null, sellThroughRate: 0 });
  assert.equal(r.roiPass, true);
  assert.equal(r.strPass, false);
  assert.equal(r.decision, 'SKIP');
});

test('normal nonzero-cost ROI threshold behavior is unchanged', () => {
  assert.equal(decide({ ...BASE, roi: 200, targetRoi: 200 }).roiPass, true);
  assert.equal(decide({ ...BASE, roi: 199.99, targetRoi: 200 }).decision, 'SKIP');
});

test('sellThroughRate exactly equal to minSellThroughRate passes', () => {
  const r = decide({ ...BASE, sellThroughRate: 30, minSellThroughRate: 30 });
  assert.equal(r.strPass, true);
});

test('sellThroughRate slightly below minSellThroughRate fails -> SKIP', () => {
  const r = decide({ ...BASE, sellThroughRate: 29.99, minSellThroughRate: 30 });
  assert.equal(r.strPass, false);
  assert.equal(r.decision, 'SKIP');
});

test('daysToSell exactly equal to maxDaysToSell passes', () => {
  const r = decide({ ...BASE, daysToSell: 60, maxDaysToSell: 60 });
  assert.equal(r.daysPass, true);
});

test('daysToSell one day above maxDaysToSell fails -> SKIP', () => {
  const r = decide({ ...BASE, daysToSell: 61, maxDaysToSell: 60 });
  assert.equal(r.daysPass, false);
  assert.equal(r.decision, 'SKIP');
});

test('missing market evidence (nulls) fails those thresholds, never fabricated as passing', () => {
  const r = decide({ ...BASE, sellThroughRate: null, daysToSell: null, demandLevel: null });
  assert.equal(r.strPass, false);
  assert.equal(r.daysPass, false);
  assert.equal(r.demandIsVeryHigh, false);
  assert.equal(r.decision, 'SKIP');
});

test('every single-threshold failure independently produces SKIP', () => {
  assert.equal(decide({ ...BASE, netProfit: 0 }).decision, 'SKIP');
  assert.equal(decide({ ...BASE, roi: 50 }).decision, 'SKIP');
  assert.equal(decide({ ...BASE, sellThroughRate: 0 }).decision, 'SKIP');
  assert.equal(decide({ ...BASE, daysToSell: 999 }).decision, 'SKIP');
});

test('profit at exactly 2x minProfit does not independently trigger HOT without demand=VERY HIGH', () => {
  const r = decide({ ...BASE, netProfit: 30, minProfit: 15, demandLevel: 'HIGH' });
  assert.equal(r.decision, 'LIST');
});

test('high confidence is not a decision input at all — function has no confidence parameter', () => {
  // Type-level guarantee: DecisionInputs has no `confidence` field. This test
  // documents the rule that confidence must never substitute for thresholds.
  const r = decide(BASE);
  assert.ok(!('confidence' in r));
});
