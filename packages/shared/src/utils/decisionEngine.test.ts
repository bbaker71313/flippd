// Boundary tests for the authoritative HOT/LIST/SKIP decision engine.
// Runner: `node --test decisionEngine.test.ts` (type-stripped, no live services).
//
// Profit Scanner v2: decide() takes netProfit/roi/minProfit/targetRoi plus a
// marketplace-independent evidenceQuality tier ('strong'|'moderate' only —
// 'weak'/'none' must never reach decide(), see evidenceQuality.ts). There is
// no sell-through-rate/days-to-sell/demand-level input any more.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from './decisionEngine.ts';
import type { DecisionInputs } from '../types/index.ts';

const BASE: DecisionInputs = {
  netProfit: 100,
  roi: 250,
  minProfit: 15,
  targetRoi: 200,
  evidenceQuality: 'strong',
};

test('strong evidence + profit pass + roi pass -> HOT', () => {
  const r = decide(BASE);
  assert.equal(r.decision, 'HOT');
  assert.equal(r.failingThresholds.length, 0);
});

test('moderate evidence + profit pass + roi pass -> LIST, never HOT', () => {
  const r = decide({ ...BASE, evidenceQuality: 'moderate' });
  assert.equal(r.decision, 'LIST');
});

test('strong evidence alone never triggers HOT — financial thresholds still required', () => {
  const r = decide({ ...BASE, netProfit: 5 });
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

test('$0-cost item passing profit qualifies as HOT with strong evidence', () => {
  const r = decide({ ...BASE, roi: null });
  assert.equal(r.decision, 'HOT');
  assert.equal(r.failingThresholds.length, 0);
});

test('$0-cost item still SKIPs when profit fails', () => {
  const r = decide({ ...BASE, roi: null, netProfit: 0 });
  assert.equal(r.roiPass, true);
  assert.equal(r.profitPass, false);
  assert.equal(r.decision, 'SKIP');
});

test('normal nonzero-cost ROI threshold behavior is unchanged', () => {
  assert.equal(decide({ ...BASE, roi: 200, targetRoi: 200 }).roiPass, true);
  assert.equal(decide({ ...BASE, roi: 199.99, targetRoi: 200 }).decision, 'SKIP');
});

test('every single-threshold failure independently produces SKIP', () => {
  assert.equal(decide({ ...BASE, netProfit: 0 }).decision, 'SKIP');
  assert.equal(decide({ ...BASE, roi: 50 }).decision, 'SKIP');
});

test('confidence is not a decision input at all — function has no confidence parameter', () => {
  // Type-level guarantee: DecisionInputs has no `confidence` field. This test
  // documents the rule that confidence must never substitute for thresholds.
  const r = decide(BASE);
  assert.ok(!('confidence' in r));
});

test('sell-through rate / days-to-sell / demand level are not decision inputs at all', () => {
  // Type-level guarantee: DecisionInputs has no such fields any more.
  const r = decide(BASE);
  assert.ok(!('strPass' in r));
  assert.ok(!('daysPass' in r));
  assert.ok(!('demandIsVeryHigh' in r));
  assert.ok(!('hotCappedByEvidence' in r));
});

test('strong vs moderate is the only thing separating HOT from LIST when thresholds pass', () => {
  assert.equal(decide({ ...BASE, evidenceQuality: 'strong' }).decision, 'HOT');
  assert.equal(decide({ ...BASE, evidenceQuality: 'moderate' }).decision, 'LIST');
});

test('moderate evidence does not turn a passing scan into a SKIP, and does not affect a genuine SKIP', () => {
  assert.equal(decide({ ...BASE, evidenceQuality: 'moderate' }).decision, 'LIST');
  assert.equal(decide({ ...BASE, netProfit: 0, evidenceQuality: 'moderate' }).decision, 'SKIP');
});
