import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { computeStaleInventoryItems, type StaleCandidateRow } from './staleInventory.ts';

const DAY = 86400000;
const NOW = Date.parse('2026-08-27T00:00:00.000Z');

function row(over: Partial<StaleCandidateRow>): StaleCandidateRow {
  return { sku: 'SKU-1', nickname: 'Widget', status: 'Unlisted', created_at: new Date(NOW).toISOString(), listed_at: null, ...over };
}

Deno.test('computeStaleInventoryItems: a Listed item created long ago but listed recently is not stale', () => {
  const rows = [row({
    status: 'Listed',
    created_at: new Date(NOW - 200 * DAY).toISOString(),
    listed_at: new Date(NOW - 5 * DAY).toISOString(),
  })];
  const result = computeStaleInventoryItems(rows, 60, NOW);
  assertEquals(result.length, 0);
});

Deno.test('computeStaleInventoryItems: a Listed item created recently but listed long ago is stale', () => {
  const rows = [row({
    status: 'Listed',
    created_at: new Date(NOW - 5 * DAY).toISOString(),
    listed_at: new Date(NOW - 200 * DAY).toISOString(),
  })];
  const result = computeStaleInventoryItems(rows, 60, NOW);
  assertEquals(result.length, 1);
  assertEquals(result[0].days, 200);
});

Deno.test('computeStaleInventoryItems: exact stale_days boundary — just under is not stale, just over is', () => {
  const justUnder = row({ status: 'Listed', listed_at: new Date(NOW - (60 * DAY - 1000)).toISOString() });
  const justOver = row({ status: 'Listed', listed_at: new Date(NOW - (60 * DAY + 1000)).toISOString() });
  assertEquals(computeStaleInventoryItems([justUnder], 60, NOW).length, 0);
  assertEquals(computeStaleInventoryItems([justOver], 60, NOW).length, 1);
});

Deno.test('computeStaleInventoryItems: a Listed item with null listed_at falls back to created_at (legacy behavior)', () => {
  const rows = [row({
    status: 'Listed',
    created_at: new Date(NOW - 200 * DAY).toISOString(),
    listed_at: null,
  })];
  const result = computeStaleInventoryItems(rows, 60, NOW);
  assertEquals(result.length, 1);
  assertEquals(result[0].days, 200);
});

Deno.test('computeStaleInventoryItems: an Unlisted item always uses created_at, ignoring any listed_at', () => {
  const rows = [row({
    status: 'Unlisted',
    created_at: new Date(NOW - 200 * DAY).toISOString(),
    listed_at: new Date(NOW - 1 * DAY).toISOString(), // should never be consulted for Unlisted
  })];
  const result = computeStaleInventoryItems(rows, 60, NOW);
  assertEquals(result.length, 1);
  assertEquals(result[0].days, 200);
});

Deno.test('computeStaleInventoryItems: a fresh Unlisted item is not stale', () => {
  const rows = [row({ status: 'Unlisted', created_at: new Date(NOW - 5 * DAY).toISOString() })];
  assertEquals(computeStaleInventoryItems(rows, 60, NOW).length, 0);
});

Deno.test('computeStaleInventoryItems: sorted oldest-first and capped at the limit', () => {
  const rows = [
    row({ sku: 'A', status: 'Listed', listed_at: new Date(NOW - 70 * DAY).toISOString() }),
    row({ sku: 'B', status: 'Listed', listed_at: new Date(NOW - 100 * DAY).toISOString() }),
    row({ sku: 'C', status: 'Listed', listed_at: new Date(NOW - 90 * DAY).toISOString() }),
  ];
  const result = computeStaleInventoryItems(rows, 60, NOW, 2);
  assertEquals(result.length, 2);
  assertEquals(result[0].sku, 'B');
  assertEquals(result[1].sku, 'C');
});
