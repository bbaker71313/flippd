// P1-K workflow-level integration tests for the eBay sync reconciliation
// path (ebay-oauth's pull-listings/sync-orders handlers, after the P1-I
// extraction into ebaySyncReconciliation.ts). Exercises the real production
// reconciliation functions against a fake supabase whose `.rpc()` calls are
// backed by a JS mirror of the actual Postgres RPCs (see
// _shared/testing/fakeEbayReconcileRpc.ts) — not a second implementation of
// the business rules, just enough to drive the real code under test without
// a live Postgres connection in this sandbox.
//
// Run: `deno test supabase/functions/_shared/`
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { makeFakeSupabase, type Row } from "./testing/fakeSupabase.ts";
import { makeEbayReconcileInventoryRowHandler, makeEbayReconcileSoldOrderLineHandler } from "./testing/fakeEbayReconcileRpc.ts";
import {
  overallSyncStatus,
  reconcileOffersPhase,
  reconcileActiveListingsPhase,
  reconcileOrderLines,
} from "./ebaySyncReconciliation.ts";
import type { RawOffer, FindingItem, RawOrder } from "./ebayClient.ts";

function makeEbaySupabase(seed: Row[] = []) {
  const supabase = makeFakeSupabase({ inventory: seed });
  const rpcHandlers = {
    ebay_reconcile_inventory_row: makeEbayReconcileInventoryRowHandler(
      () => supabase.__tables.inventory,
      () => Math.max(0, ...supabase.__tables.inventory.map((r) => Number(r.id) || 0)) + 1,
    ),
    ebay_reconcile_sold_order_line: makeEbayReconcileSoldOrderLineHandler(
      () => supabase.__tables.inventory,
      () => Math.max(0, ...supabase.__tables.inventory.map((r) => Number(r.id) || 0)) + 1,
    ),
  };
  // deno-lint-ignore no-explicit-any
  (supabase as any).rpc = (name: string, params: Record<string, unknown>) => {
    const handler = (rpcHandlers as Record<string, (p: Record<string, unknown>) => unknown>)[name];
    if (!handler) throw new Error(`no rpc handler for ${name}`);
    return Promise.resolve(handler(params));
  };
  return supabase;
}

// ── Offers phase ─────────────────────────────────────────────────────────

Deno.test("offers: existing listing reconciliation updates the matching row, not a new one", async () => {
  const supabase = makeEbaySupabase([
    { id: 1, user_id: 1, sku: "SKU-1", ebay_item_id: "E100", status: "Listed", sell_price: 20 },
  ]);
  const offers: RawOffer[] = [
    { status: "PUBLISHED", sku: "SKU-1", listing: { listingId: "E100" }, pricingSummary: { price: { value: "25.00" } } },
  ];
  const r = await reconcileOffersPhase(supabase, 1, offers, {});
  assertEquals(r.ok, 1);
  assertEquals(r.failed, 0);
  assertEquals(supabase.__tables.inventory.length, 1);
  assertEquals(supabase.__tables.inventory[0].sell_price, 25);
});

Deno.test("offers: repeated/replayed sync of the same eBay item never duplicates the row", async () => {
  const supabase = makeEbaySupabase([]);
  const offers: RawOffer[] = [
    { status: "PUBLISHED", sku: "SKU-2", listing: { listingId: "E200" }, pricingSummary: { price: { value: "10.00" } } },
  ];
  await reconcileOffersPhase(supabase, 1, offers, {});
  await reconcileOffersPhase(supabase, 1, offers, {}); // simulate a replayed/retried sync call
  await reconcileOffersPhase(supabase, 1, offers, {}); // and again — concurrent-looking repeats
  const matching = supabase.__tables.inventory.filter((r) => r.ebay_item_id === "E200");
  assertEquals(matching.length, 1);
});

Deno.test("offers: unambiguous SKU relist adopts the new listing id onto the existing row", async () => {
  const supabase = makeEbaySupabase([
    { id: 1, user_id: 1, sku: "SKU-3", ebay_item_id: null, status: "Unlisted" },
  ]);
  const offers: RawOffer[] = [
    { status: "PUBLISHED", sku: "SKU-3", listing: { listingId: "E300-RELIST" }, pricingSummary: { price: { value: "15.00" } } },
  ];
  const r = await reconcileOffersPhase(supabase, 1, offers, {});
  assertEquals(r.ok, 1);
  assertEquals(supabase.__tables.inventory.length, 1); // relisted, not a second row
  assertEquals(supabase.__tables.inventory[0].ebay_item_id, "E300-RELIST");
});

Deno.test("offers: ambiguous SKU (2+ non-Sold candidates) never guesses — falls through to a new row", async () => {
  const supabase = makeEbaySupabase([
    { id: 1, user_id: 1, sku: "SKU-4", ebay_item_id: null, status: "Unlisted" },
    { id: 2, user_id: 1, sku: "SKU-4", ebay_item_id: null, status: "Unlisted" },
  ]);
  const offers: RawOffer[] = [
    { status: "PUBLISHED", sku: "SKU-4", listing: { listingId: "E400" }, pricingSummary: { price: { value: "12.00" } } },
  ];
  const r = await reconcileOffersPhase(supabase, 1, offers, {});
  assertEquals(r.ok, 1);
  assertEquals(supabase.__tables.inventory.length, 3); // neither of the 2 ambiguous rows was touched
  const untouched = supabase.__tables.inventory.filter((row) => row.ebay_item_id == null);
  assertEquals(untouched.length, 2);
  const newRow = supabase.__tables.inventory.find((row) => row.ebay_item_id === "E400");
  assertEquals(newRow?.id !== 1 && newRow?.id !== 2, true);
});

Deno.test("offers: no cross-user contamination — same ebay_item_id string for two different users never collides", async () => {
  const supabase = makeEbaySupabase([]);
  const offersUser1: RawOffer[] = [{ status: "PUBLISHED", sku: "SKU-A", listing: { listingId: "SHARED-ID" }, pricingSummary: { price: { value: "1.00" } } }];
  const offersUser2: RawOffer[] = [{ status: "PUBLISHED", sku: "SKU-B", listing: { listingId: "SHARED-ID" }, pricingSummary: { price: { value: "2.00" } } }];
  await reconcileOffersPhase(supabase, 1, offersUser1, {});
  await reconcileOffersPhase(supabase, 2, offersUser2, {});
  const rows = supabase.__tables.inventory.filter((r) => r.ebay_item_id === "SHARED-ID");
  assertEquals(rows.length, 2);
  assertEquals(new Set(rows.map((r) => r.user_id)).size, 2);
});

Deno.test("offers: partial reconcile failure is reported as 'partial', not silently 'success'", async () => {
  const supabase = makeEbaySupabase([]);
  const originalRpc = supabase.rpc.bind(supabase);
  let calls = 0;
  // deno-lint-ignore no-explicit-any
  (supabase as any).rpc = (name: string, params: Record<string, unknown>) => {
    calls++;
    if (calls === 2) return Promise.resolve({ data: null, error: { message: "simulated transient DB error" } });
    return originalRpc(name, params);
  };
  const offers: RawOffer[] = [
    { status: "PUBLISHED", sku: "SKU-5", listing: { listingId: "E500" }, pricingSummary: { price: { value: "5.00" } } },
    { status: "PUBLISHED", sku: "SKU-6", listing: { listingId: "E600" }, pricingSummary: { price: { value: "6.00" } } },
  ];
  const r = await reconcileOffersPhase(supabase, 1, offers, {});
  assertEquals(r.ok, 1);
  assertEquals(r.failed, 1);
  const phaseStatus = r.failed === 0 ? 'success' : (r.ok > 0 ? 'partial' : 'failed');
  assertEquals(phaseStatus, 'partial');
});

// ── Active listings (Finding API) phase ─────────────────────────────────

Deno.test("active listings: reconciles each Finding API item via the same atomic RPC", async () => {
  const supabase = makeEbaySupabase([]);
  const items: FindingItem[] = [
    { itemId: "F1", title: "Vintage Lamp", sellPrice: 40 },
    { itemId: "F2", title: "Old Radio", sellPrice: 25 },
  ];
  const r = await reconcileActiveListingsPhase(supabase, 1, items);
  assertEquals(r.ok, 2);
  assertEquals(r.active, 2);
  assertEquals(supabase.__tables.inventory.length, 2);
});

Deno.test("active listings: repeated sync of the same Finding API item never duplicates", async () => {
  const supabase = makeEbaySupabase([]);
  const items: FindingItem[] = [{ itemId: "F3", title: "Camera", sellPrice: 99 }];
  await reconcileActiveListingsPhase(supabase, 1, items);
  await reconcileActiveListingsPhase(supabase, 1, items);
  assertEquals(supabase.__tables.inventory.filter((r) => r.ebay_item_id === "F3").length, 1);
});

// ── Order lines (sold reconciliation) ───────────────────────────────────

Deno.test("orders: sold-order reconciliation marks the matching row Sold with price/date", async () => {
  const supabase = makeEbaySupabase([
    { id: 1, user_id: 1, sku: "SKU-7", status: "Listed" },
  ]);
  const orders: RawOrder[] = [
    { orderId: "O1", creationDate: "2026-08-20T00:00:00Z", lineItems: [{ sku: "SKU-7", legacyItemId: "E700", title: "Widget", lineItemCost: { value: "42.50" } }] },
  ];
  const { synced, failed } = await reconcileOrderLines(supabase, 1, orders);
  assertEquals(synced, 1);
  assertEquals(failed, 0);
  const row = supabase.__tables.inventory.find((r) => r.id === 1);
  assertEquals(row?.status, "Sold");
  assertEquals(row?.sold_price, 42.5);
});

Deno.test("orders: repeated/replayed order sync never re-inserts a second Sold row", async () => {
  const supabase = makeEbaySupabase([]);
  const orders: RawOrder[] = [
    { orderId: "O2", creationDate: "2026-08-20T00:00:00Z", lineItems: [{ sku: "SKU-8", legacyItemId: "E800", title: "Gadget", lineItemCost: { value: "10.00" } }] },
  ];
  await reconcileOrderLines(supabase, 1, orders);
  await reconcileOrderLines(supabase, 1, orders); // replay
  const matching = supabase.__tables.inventory.filter((r) => r.ebay_item_id === "E800");
  assertEquals(matching.length, 1);
  assertEquals(matching[0].status, "Sold");
});

Deno.test("orders: partial failure across multiple line items is reported truthfully", async () => {
  const supabase = makeEbaySupabase([]);
  const originalRpc = supabase.rpc.bind(supabase);
  let calls = 0;
  // deno-lint-ignore no-explicit-any
  (supabase as any).rpc = (name: string, params: Record<string, unknown>) => {
    calls++;
    if (calls === 1) return Promise.resolve({ data: null, error: { message: "simulated failure" } });
    return originalRpc(name, params);
  };
  const orders: RawOrder[] = [
    { orderId: "O3", lineItems: [
      { sku: "SKU-9", legacyItemId: "E900", lineItemCost: { value: "1.00" } },
      { sku: "SKU-10", legacyItemId: "E901", lineItemCost: { value: "2.00" } },
    ] },
  ];
  const { synced, failed } = await reconcileOrderLines(supabase, 1, orders);
  assertEquals(synced, 1);
  assertEquals(failed, 1);
});

// ── overallSyncStatus truthfulness ──────────────────────────────────────

Deno.test("overallSyncStatus: all success -> success", () => {
  assertEquals(overallSyncStatus([
    { name: 'offers', status: 'success', count: 2 },
    { name: 'active_listings', status: 'success', count: 1 },
    { name: 'orders', status: 'success', count: 0 },
  ]), 'success');
});

Deno.test("overallSyncStatus: one phase failed among successes -> partial_failure, never silently success", () => {
  assertEquals(overallSyncStatus([
    { name: 'offers', status: 'success', count: 2 },
    { name: 'orders', status: 'failed', count: 0, detail: 'eBay orders API HTTP 500' },
  ]), 'partial_failure');
});

Deno.test("overallSyncStatus: all phases failed -> failure", () => {
  assertEquals(overallSyncStatus([
    { name: 'offers', status: 'failed', count: 0 },
    { name: 'orders', status: 'failed', count: 0 },
  ]), 'failure');
});

Deno.test("overallSyncStatus: skipped phases are excluded, not counted as failures", () => {
  assertEquals(overallSyncStatus([
    { name: 'offers', status: 'success', count: 2 },
    { name: 'active_listings', status: 'skipped', count: 0 },
  ]), 'success');
});

// P2-24
Deno.test("overallSyncStatus: a truncated phase (hit the pagination ceiling) is never reported as a full success", () => {
  assertEquals(overallSyncStatus([
    { name: 'offers', status: 'success', count: 200, truncated: true },
    { name: 'orders', status: 'success', count: 5 },
  ]), 'partial_failure');
});

Deno.test("overallSyncStatus: no phase truncated -> still success", () => {
  assertEquals(overallSyncStatus([
    { name: 'offers', status: 'success', count: 200, truncated: false },
  ]), 'success');
});
