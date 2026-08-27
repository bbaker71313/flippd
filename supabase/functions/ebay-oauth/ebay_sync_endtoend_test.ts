// P1-K workflow-level integration tests for the real production eBay sync
// handlers (handlePullListings / handleSyncOrders), exercised end-to-end:
// real auth (JWT cookie + fake users table), a mocked global fetch standing
// in for eBay's HTTP APIs, and a fake supabase client whose reconciliation
// RPCs mirror the real Postgres functions (see
// _shared/testing/fakeEbayReconcileRpc.ts). This proves the actual wiring in
// ebay-oauth/index.ts — not just the extracted reconciliation module — is
// correct: auth, response shape, and truthful status reporting on the real
// code path.
//
// Run: `deno test supabase/functions/ebay-oauth/`
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { signJWT } from "../_shared/jwt.ts";
import { makeFakeSupabase } from "../_shared/testing/fakeSupabase.ts";
import { makeEbayReconcileInventoryRowHandler, makeEbayReconcileSoldOrderLineHandler } from "../_shared/testing/fakeEbayReconcileRpc.ts";
import { handlePullListings, handleSyncOrders } from "./index.ts";

const JWT_SECRET = "test-secret-not-real";
const USER_ID = 42;

Deno.env.set("EBAY_CLIENT_ID", "test-app-id");
Deno.env.set("EBAY_SANDBOX", "false");

async function authedRequest(url: string, init: RequestInit = {}) {
  const token = await signJWT({ sub: USER_ID, token_version: 0 }, JWT_SECRET);
  return new Request(url, {
    ...init,
    method: init.method ?? "POST",
    headers: { ...(init.headers ?? {}), Cookie: `sfp_auth=${token}` },
  });
}

function makeSyncSupabase(inventorySeed: Record<string, unknown>[] = []) {
  const supabase = makeFakeSupabase({
    users: [{ id: USER_ID, token_version: 0 }],
    ebay_connections: [{ user_id: USER_ID, ebay_username: "test-seller" }],
    inventory: inventorySeed,
  });
  const rpcHandlers: Record<string, (p: Record<string, unknown>) => unknown> = {
    ebay_get_tokens: () => ({
      data: [{ access_token: "valid-token", expires_at: new Date(Date.now() + 3600_000).toISOString(), refresh_token: "r" }],
      error: null,
    }),
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
    const handler = rpcHandlers[name];
    if (!handler) throw new Error(`no rpc handler for ${name}`);
    return Promise.resolve(handler(params));
  };
  return supabase;
}

function mockFetch(handlers: Array<{ match: (url: string) => boolean; respond: () => Response }>) {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, _init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    for (const h of handlers) {
      if (h.match(url)) return Promise.resolve(h.respond());
    }
    throw new Error(`mockFetch: no handler matched ${url}`);
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.test("handlePullListings: end-to-end — offers + finding + orders all succeed -> status 'success'", async () => {
  const supabase = makeSyncSupabase();
  const restore = mockFetch([
    { match: (u) => u.includes("/sell/inventory/v1/inventory_item"), respond: () => jsonResponse({ inventoryItems: [] }) },
    { match: (u) => u.includes("/sell/inventory/v1/offer?limit=200"), respond: () => jsonResponse({
      offers: [{ status: "PUBLISHED", sku: "SKU-E2E-1", listing: { listingId: "E2E-1" }, pricingSummary: { price: { value: "9.99" } } }],
    }) },
    { match: (u) => u.includes("FindingService"), respond: () => jsonResponse({
      findItemsAdvancedResponse: [{ searchResult: [{ item: [] }], paginationOutput: [{ totalEntries: ["0"] }] }],
    }) },
    { match: (u) => u.includes("/sell/fulfillment/v1/order"), respond: () => jsonResponse({ orders: [] }) },
  ]);
  try {
    const req = await authedRequest("https://x/ebay-oauth/pull-listings", { body: JSON.stringify({}) });
    // deno-lint-ignore no-explicit-any
    const res = await handlePullListings(req, supabase as any, JWT_SECRET);
    const body = await res.json();
    assertEquals(res.status, 200);
    assertEquals(body.status, "success");
    assertEquals(body.active, 1);
    assertEquals(body.phases.map((p: { name: string }) => p.name).sort(), ["active_listings", "offers", "orders"]);
  } finally {
    restore();
  }
});

Deno.test("handlePullListings: end-to-end — a failing phase yields truthful 'partial_failure', never masked as success", async () => {
  const supabase = makeSyncSupabase();
  const restore = mockFetch([
    { match: (u) => u.includes("/sell/inventory/v1/inventory_item"), respond: () => jsonResponse({ inventoryItems: [] }) },
    { match: (u) => u.includes("/sell/inventory/v1/offer?limit=200"), respond: () => jsonResponse({
      offers: [{ status: "PUBLISHED", sku: "SKU-E2E-2", listing: { listingId: "E2E-2" }, pricingSummary: { price: { value: "5.00" } } }],
    }) },
    { match: (u) => u.includes("FindingService"), respond: () => jsonResponse({}, 500) }, // simulated eBay outage for this phase
    { match: (u) => u.includes("/sell/fulfillment/v1/order"), respond: () => jsonResponse({ orders: [] }) },
  ]);
  try {
    const req = await authedRequest("https://x/ebay-oauth/pull-listings", { body: JSON.stringify({}) });
    // deno-lint-ignore no-explicit-any
    const res = await handlePullListings(req, supabase as any, JWT_SECRET);
    const body = await res.json();
    assertEquals(res.status, 200); // the endpoint itself succeeds — the *sync* is what's partial
    assertEquals(body.status, "partial_failure");
    const activePhase = body.phases.find((p: { name: string }) => p.name === "active_listings");
    assertEquals(activePhase.status, "failed");
    const offersPhase = body.phases.find((p: { name: string }) => p.name === "offers");
    assertEquals(offersPhase.status, "success");
  } finally {
    restore();
  }
});

Deno.test("handlePullListings: repeated/replayed sync of the same offer never duplicates inventory rows", async () => {
  const supabase = makeSyncSupabase();
  const restore = mockFetch([
    { match: (u) => u.includes("/sell/inventory/v1/inventory_item"), respond: () => jsonResponse({ inventoryItems: [] }) },
    { match: (u) => u.includes("/sell/inventory/v1/offer?limit=200"), respond: () => jsonResponse({
      offers: [{ status: "PUBLISHED", sku: "SKU-E2E-3", listing: { listingId: "E2E-3" }, pricingSummary: { price: { value: "7.00" } } }],
    }) },
    { match: (u) => u.includes("FindingService"), respond: () => jsonResponse({
      findItemsAdvancedResponse: [{ searchResult: [{ item: [] }], paginationOutput: [{ totalEntries: ["0"] }] }],
    }) },
    { match: (u) => u.includes("/sell/fulfillment/v1/order"), respond: () => jsonResponse({ orders: [] }) },
  ]);
  try {
    const req1 = await authedRequest("https://x/ebay-oauth/pull-listings", { body: JSON.stringify({}) });
    // deno-lint-ignore no-explicit-any
    await handlePullListings(req1, supabase as any, JWT_SECRET);
    const req2 = await authedRequest("https://x/ebay-oauth/pull-listings", { body: JSON.stringify({}) });
    // deno-lint-ignore no-explicit-any
    await handlePullListings(req2, supabase as any, JWT_SECRET);
    const matching = supabase.__tables.inventory.filter((r) => r.ebay_item_id === "E2E-3");
    assertEquals(matching.length, 1);
  } finally {
    restore();
  }
});

Deno.test("handleSyncOrders: end-to-end — reconciles fulfilled orders to Sold, truthful status", async () => {
  const supabase = makeSyncSupabase([{ id: 1, user_id: USER_ID, sku: "SKU-ORD-1", status: "Listed" }]);
  const restore = mockFetch([
    { match: (u) => u.includes("/sell/fulfillment/v1/order"), respond: () => jsonResponse({
      orders: [{ orderId: "O-E2E-1", creationDate: "2026-08-20T00:00:00Z", lineItems: [{ sku: "SKU-ORD-1", legacyItemId: "E-ORD-1", lineItemCost: { value: "30.00" } }] }],
    }) },
  ]);
  try {
    const req = await authedRequest("https://x/ebay-oauth/sync-orders");
    // deno-lint-ignore no-explicit-any
    const res = await handleSyncOrders(req, supabase as any, JWT_SECRET);
    const body = await res.json();
    assertEquals(res.status, 200);
    assertEquals(body.status, "success");
    assertEquals(body.synced, 1);
    const row = supabase.__tables.inventory.find((r) => r.id === 1);
    assertEquals(row?.status, "Sold");
    assertEquals(row?.sold_price, 30);
  } finally {
    restore();
  }
});

Deno.test("handlePullListings: unauthenticated request is rejected before touching eBay or the DB", async () => {
  const supabase = makeSyncSupabase();
  const restore = mockFetch([
    { match: () => true, respond: () => { throw new Error("must not call eBay for an unauthenticated request"); } },
  ]);
  try {
    const req = new Request("https://x/ebay-oauth/pull-listings", { method: "POST", body: JSON.stringify({}) }); // no auth cookie
    // deno-lint-ignore no-explicit-any
    const res = await handlePullListings(req, supabase as any, JWT_SECRET);
    assertEquals(res.status, 401);
  } finally {
    restore();
  }
});
