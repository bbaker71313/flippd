// P2-24 tests: eBay list-fetch pagination (fetchInventoryTitleMap,
// fetchOffers, fetchOrders, fetchActiveListingsViaFindingApi) must walk every
// page instead of silently returning only the first 200 records, must never
// loop forever, and must truthfully report `truncated: true` when a
// configurable safety ceiling is hit before the data was exhausted.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  fetchInventoryTitleMap, fetchOffers, fetchOrders, fetchActiveListingsViaFindingApi,
} from './ebayClient.ts';

function withEnv<T>(vars: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const prior: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) { prior[k] = Deno.env.get(k); Deno.env.set(k, vars[k]); }
  return fn().finally(() => {
    for (const k of Object.keys(vars)) { if (prior[k] === undefined) Deno.env.delete(k); else Deno.env.set(k, prior[k]!); }
  });
}

const originalFetch = globalThis.fetch;
function stubFetch(impl: typeof fetch) { globalThis.fetch = impl; }
function restoreFetch() { globalThis.fetch = originalFetch; }

function urlOf(input: string | URL | Request): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
}

Deno.test('fetchOffers: 201 offers across 2 pages are all fetched, not just the first 200', async () => {
  const page0 = Array.from({ length: 200 }, (_, i) => ({ sku: `sku-${i}` }));
  const page1 = [{ sku: 'sku-200' }];
  let calls = 0;
  stubFetch((input) => {
    calls++;
    const offset = new URL(urlOf(input)).searchParams.get('offset');
    const body = offset === '0' ? { offers: page0, total: 201 } : { offers: page1, total: 201 };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  });
  try {
    const result = await fetchOffers('https://api.ebay.com', {});
    assertEquals(result.ok, true);
    assertEquals(result.offers.length, 201);
    assertEquals(result.truncated, false);
    assertEquals(calls, 2);
  } finally { restoreFetch(); }
});

Deno.test('fetchOffers: exhausted via a short final page even without a total field', async () => {
  let calls = 0;
  stubFetch((input) => {
    calls++;
    const offset = new URL(urlOf(input)).searchParams.get('offset');
    const body = offset === '0'
      ? { offers: Array.from({ length: 200 }, (_, i) => ({ sku: `${i}` })) }
      : { offers: [{ sku: 'last' }] }; // short page, no `total` reported
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  });
  try {
    const result = await fetchOffers('https://api.ebay.com', {});
    assertEquals(result.offers.length, 201);
    assertEquals(result.truncated, false);
    assertEquals(calls, 2);
  } finally { restoreFetch(); }
});

Deno.test('fetchOrders: 201+ orders across pages are fully fetched and correctly not truncated', async () => {
  stubFetch((input) => {
    const offset = Number(new URL(urlOf(input)).searchParams.get('offset'));
    const remaining = 250 - offset;
    const pageSize = Math.max(0, Math.min(200, remaining));
    const orders = Array.from({ length: pageSize }, (_, i) => ({ orderId: `o-${offset + i}` }));
    return Promise.resolve(new Response(JSON.stringify({ orders, total: 250 }), { status: 200 }));
  });
  try {
    const result = await fetchOrders('https://api.ebay.com', {}, '2026-01-01T00:00:00Z');
    assertEquals(result.orders.length, 250);
    assertEquals(result.truncated, false);
  } finally { restoreFetch(); }
});

Deno.test('fetchInventoryTitleMap: multi-page enrichment collects sku→title across all pages', async () => {
  stubFetch((input) => {
    const offset = new URL(urlOf(input)).searchParams.get('offset');
    const body = offset === '0'
      ? { inventoryItems: Array.from({ length: 200 }, (_, i) => ({ sku: `s${i}`, product: { title: `T${i}` } })), total: 202 }
      : { inventoryItems: [{ sku: 's200', product: { title: 'T200' } }, { sku: 's201', product: { title: 'T201' } }], total: 202 };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  });
  try {
    const { titleMap, truncated } = await fetchInventoryTitleMap('https://api.ebay.com', {});
    assertEquals(Object.keys(titleMap).length, 202);
    assertEquals(titleMap['s201'], 'T201');
    assertEquals(truncated, false);
  } finally { restoreFetch(); }
});

Deno.test('fetchOffers: a failure partway through pagination reports truncated (partial data, not silent success)', async () => {
  let calls = 0;
  stubFetch((input) => {
    calls++;
    const offset = new URL(urlOf(input)).searchParams.get('offset');
    if (offset === '0') {
      return Promise.resolve(new Response(JSON.stringify({ offers: Array.from({ length: 200 }, () => ({})), total: 500 }), { status: 200 }));
    }
    return Promise.resolve(new Response('', { status: 500 }));
  });
  try {
    const result = await fetchOffers('https://api.ebay.com', {});
    assertEquals(result.ok, true); // partial data is still usable
    assertEquals(result.offers.length, 200);
    assertEquals(result.truncated, true);
  } finally { restoreFetch(); }
});

Deno.test('fetchOffers: hitting the configured page-count safety ceiling reports truncated, never an infinite loop', async () => {
  let calls = 0;
  stubFetch(() => {
    calls++;
    // Always claims there's more data (total far larger than anything fetched) —
    // without a ceiling this would loop forever.
    return Promise.resolve(new Response(JSON.stringify({ offers: Array.from({ length: 200 }, () => ({})), total: 999999 }), { status: 200 }));
  });
  try {
    const result = await withEnv({ EBAY_SYNC_MAX_PAGES: '3' }, () => fetchOffers('https://api.ebay.com', {}));
    assertEquals(calls, 3); // stopped at the ceiling, not looping
    assertEquals(result.offers.length, 600);
    assertEquals(result.truncated, true);
  } finally { restoreFetch(); }
});

Deno.test('fetchActiveListingsViaFindingApi: paginates beyond the old 2-page/200-listing ceiling', async () => {
  function findingResponse(page: number, entriesPerPage: number, totalEntries: number) {
    const start = (page - 1) * entriesPerPage;
    const count = Math.max(0, Math.min(entriesPerPage, totalEntries - start));
    const item = Array.from({ length: count }, (_, i) => ({
      itemId: [`id-${start + i}`], title: [`Item ${start + i}`],
    }));
    return {
      findItemsAdvancedResponse: [{
        searchResult: [{ item }],
        paginationOutput: [{ totalEntries: [String(totalEntries)] }],
      }],
    };
  }
  let calls = 0;
  stubFetch((input) => {
    calls++;
    const url = new URL(urlOf(input));
    const page = Number(url.searchParams.get('paginationInput.pageNumber'));
    return Promise.resolve(new Response(JSON.stringify(findingResponse(page, 100, 350)), { status: 200 }));
  });
  try {
    const result = await fetchActiveListingsViaFindingApi('https://svcs.ebay.com/find', 'app-id', 'seller1');
    assertEquals(result.items.length, 350);
    assertEquals(result.truncated, false);
    assertEquals(calls, 4); // 100+100+100+50
  } finally { restoreFetch(); }
});

Deno.test('fetchActiveListingsViaFindingApi: hitting the safety ceiling reports truncated, never loops forever', async () => {
  let calls = 0;
  stubFetch(() => {
    calls++;
    return Promise.resolve(new Response(JSON.stringify({
      findItemsAdvancedResponse: [{
        searchResult: [{ item: Array.from({ length: 100 }, (_, i) => ({ itemId: [`id-${calls}-${i}`] })) }],
        paginationOutput: [{ totalEntries: ['999999'] }],
      }],
    }), { status: 200 }));
  });
  try {
    const result = await withEnv({ EBAY_SYNC_MAX_PAGES: '2' }, () =>
      fetchActiveListingsViaFindingApi('https://svcs.ebay.com/find', 'app-id', 'seller1'));
    assertEquals(calls, 2);
    assertEquals(result.truncated, true);
  } finally { restoreFetch(); }
});
