// P1-I: eBay provider/transport boundary — talking to eBay's HTTP APIs and
// parsing their wire formats. Reconciling results into our own inventory
// table is a separate concern, in ebaySyncReconciliation.ts. Extracted
// verbatim (no behavior change) from ebay-oauth/index.ts.

export function ebayUrls() {
  const sandbox = Deno.env.get('EBAY_SANDBOX') === 'true';
  return {
    auth:     sandbox ? 'https://auth.sandbox.ebay.com/oauth2/authorize'          : 'https://auth.ebay.com/oauth2/authorize',
    token:    sandbox ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'   : 'https://api.ebay.com/identity/v1/oauth2/token',
    api:      sandbox ? 'https://api.sandbox.ebay.com'                             : 'https://api.ebay.com',
    identity: sandbox ? 'https://apiz.sandbox.ebay.com/commerce/identity/v1/user/': 'https://apiz.ebay.com/commerce/identity/v1/user/',
    finding:  sandbox ? 'https://svcs.sandbox.ebay.com/services/search/FindingService/v1' : 'https://svcs.ebay.com/services/search/FindingService/v1',
  };
}

export function ebayCreds() {
  const sandbox = Deno.env.get('EBAY_SANDBOX') === 'true';
  return {
    clientId:     Deno.env.get(sandbox ? 'EBAY_SANDBOX_CLIENT_ID'     : 'EBAY_CLIENT_ID'),
    clientSecret: Deno.env.get(sandbox ? 'EBAY_SANDBOX_CLIENT_SECRET' : 'EBAY_CLIENT_SECRET'),
    ruName:       Deno.env.get(sandbox ? 'EBAY_SANDBOX_RUNAME'        : 'EBAY_RUNAME'),
  };
}

// P1-A: narrowly-scoped retry for this sync only — bounded exponential
// backoff, transient failures only (network error, 429, 5xx). Never retries
// permanent failures (400/401/403/other 4xx/validation errors) per the
// approved eBay retry policy (DECISIONS.md / remediation prompt).
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      const isTransientHttp = res.status === 429 || res.status >= 500;
      if (!isTransientHttp || attempt === maxAttempts) return res;
      lastErr = new Error(`transient HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) throw err;
    }
    await new Promise((r) => setTimeout(r, 300 * 2 ** (attempt - 1)));
  }
  throw lastErr;
}

function isFresh(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) > new Date(Date.now() + 60_000);
}

// P2-25: Edge Functions may run on multiple instances, so an in-memory lock
// can't prevent two concurrent requests from both deciding a refresh is
// needed and both refreshing at once. ebay_claim_token_refresh() is a
// DB-level single-flight boundary (row lock, one row per user) — only one
// caller gets claimed=true and actually talks to eBay; everyone else either
// gets the already-fresh token back or waits briefly and re-reads it.
// deno-lint-ignore no-explicit-any
export async function getValidEbayToken(
  userId: number,
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<string | null> {
  // Decrypts via SECURITY DEFINER RPC (SEC-010); returns 0 or 1 row.
  const { data: rows } = await supabase.rpc('ebay_get_tokens', { p_user_id: userId });
  const conn = Array.isArray(rows) ? rows[0] : null;

  if (!conn?.access_token) return null;
  if (isFresh(conn.expires_at)) return conn.access_token;

  const { data: claimRows } = await supabase.rpc('ebay_claim_token_refresh', { p_user_id: userId });
  const claim = Array.isArray(claimRows) ? claimRows[0] : null;
  if (!claim) return null;

  if (!claim.claimed) {
    // Someone else already refreshed it (fresh token returned) — done.
    if (isFresh(claim.expires_at) && claim.access_token) return claim.access_token;
    // Someone else's claim is still live — wait briefly for them to finish, then re-read once.
    await new Promise((r) => setTimeout(r, 400));
    const { data: rows2 } = await supabase.rpc('ebay_get_tokens', { p_user_id: userId });
    const conn2 = Array.isArray(rows2) ? rows2[0] : null;
    return isFresh(conn2?.expires_at) ? conn2.access_token : null;
  }

  // We hold the claim — perform the actual refresh. A failure below always
  // releases the claim via ebay_complete_token_refresh(success=false) so a
  // crashed/errored refresh can never permanently deadlock this user; the
  // stale-claim TTL in ebay_claim_token_refresh is the second-layer recovery
  // if this process dies before reaching that call at all.
  const { clientId, clientSecret } = ebayCreds();
  if (!clientId || !clientSecret || !conn.refresh_token) {
    await supabase.rpc('ebay_complete_token_refresh', {
      p_user_id: userId, p_access: null, p_expires: null, p_success: false,
    });
    return null;
  }

  let refreshRes: Response;
  try {
    refreshRes = await fetch(ebayUrls().token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refresh_token }),
    });
  } catch {
    await supabase.rpc('ebay_complete_token_refresh', {
      p_user_id: userId, p_access: null, p_expires: null, p_success: false,
    });
    return null;
  }

  if (!refreshRes.ok) {
    await supabase.rpc('ebay_complete_token_refresh', {
      p_user_id: userId, p_access: null, p_expires: null, p_success: false,
    });
    return null;
  }

  const refreshData = await refreshRes.json();
  const newExpires = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

  await supabase.rpc('ebay_complete_token_refresh', {
    p_user_id: userId, p_access: refreshData.access_token, p_expires: newExpires, p_success: true,
  });

  return refreshData.access_token;
}

export type RawOffer = {
  status?: string;
  sku?: string | null;
  listing?: { listingId?: string | null };
  pricingSummary?: { price?: { value?: string } };
  categoryId?: string | number;
};

// P2-24: eBay's REST list endpoints (inventory_item, offer, order) cap each
// response at 200 records and expose `total`/`offset`/`limit` for
// pagination. A single `limit=200` call silently returned only the first
// page for any seller with more than 200 records. This walks every page up
// to a safety ceiling (configurable — EBAY_SYNC_MAX_PAGES, default 25 pages
// = 5000 records) rather than looping forever; hitting the ceiling is
// reported as `truncated: true` so a sync is never claimed complete when it
// wasn't. offset strictly increases every iteration and an empty/short page
// always stops the loop, so a stuck continuation can't spin.
const DEFAULT_PAGE_SIZE = 200;

function ebaySyncMaxPages(): number {
  const raw = Number(Deno.env.get('EBAY_SYNC_MAX_PAGES'));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 25;
}

interface PagedEbayResult<T> {
  ok: boolean;
  status: number;
  items: T[];
  truncated: boolean;
}

async function fetchEbayPaged<T>(
  makeUrl: (limit: number, offset: number) => string,
  headers: Record<string, string>,
  // deno-lint-ignore no-explicit-any
  extractItems: (data: any) => T[] | undefined,
  // deno-lint-ignore no-explicit-any
  extractTotal: (data: any) => number | undefined,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<PagedEbayResult<T>> {
  const maxPages = ebaySyncMaxPages();
  const items: T[] = [];
  let offset = 0;
  let lastStatus = 200;

  for (let page = 0; page < maxPages; page++) {
    const res = await fetchWithRetry(makeUrl(pageSize, offset), { headers });
    lastStatus = res.status;
    if (!res.ok) {
      // A failure on the very first page means the whole fetch failed — no
      // usable data. A failure partway through means we do have some data,
      // but stopped before exhausting the list — that's a truncation, not a
      // clean end, so it must not be reported as a complete fetch.
      if (page === 0) return { ok: false, status: res.status, items, truncated: false };
      return { ok: true, status: res.status, items, truncated: true };
    }

    // deno-lint-ignore no-explicit-any
    const data = await res.json() as any;
    const pageItems = extractItems(data) ?? [];
    items.push(...pageItems);
    const total = extractTotal(data);
    offset += pageSize;

    if (pageItems.length === 0) return { ok: true, status: lastStatus, items, truncated: false };
    if (typeof total === 'number' && items.length >= total) return { ok: true, status: lastStatus, items, truncated: false };
    if (pageItems.length < pageSize) return { ok: true, status: lastStatus, items, truncated: false };
    if (page === maxPages - 1) return { ok: true, status: lastStatus, items, truncated: true };
  }
  return { ok: true, status: lastStatus, items, truncated: true };
}

// Best-effort sku->title enrichment for offers. Never a reason to fail a
// phase — swallow errors and return whatever was gathered (possibly empty).
export async function fetchInventoryTitleMap(
  apiBase: string,
  headers: Record<string, string>,
): Promise<{ titleMap: Record<string, string>; truncated: boolean }> {
  const titleMap: Record<string, string> = {};
  let truncated = false;
  try {
    // deno-lint-ignore no-explicit-any
    const { items, truncated: t } = await fetchEbayPaged<any>(
      (limit, offset) => `${apiBase}/sell/inventory/v1/inventory_item?limit=${limit}&offset=${offset}`,
      headers,
      (d) => d.inventoryItems,
      (d) => d.total,
    );
    truncated = t;
    for (const item of items) {
      if (item.sku && item.product?.title) titleMap[item.sku] = item.product.title;
    }
  } catch { /* title lookup is best-effort */ }
  return { titleMap, truncated };
}

export async function fetchOffers(
  apiBase: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; status: number; offers: RawOffer[]; truncated: boolean }> {
  const { ok, status, items, truncated } = await fetchEbayPaged<RawOffer>(
    (limit, offset) => `${apiBase}/sell/inventory/v1/offer?limit=${limit}&offset=${offset}`,
    headers,
    (d) => d.offers,
    (d) => d.total,
  );
  return { ok, status, offers: items, truncated };
}

// Reads the connected seller's eBay username (needed for the Finding API
// search), lazily fetching + persisting it via the identity API if it wasn't
// captured during OAuth. Mixed provider+DB concern by nature — kept as one
// cohesive unit rather than split further.
// deno-lint-ignore no-explicit-any
export async function resolveSellerUsername(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: number,
  accessToken: string | null,
  identityUrl: string,
): Promise<string | null> {
  const { data: conn } = await supabase
    .from('ebay_connections')
    .select('ebay_username')
    .eq('user_id', userId)
    .maybeSingle();
  let sellerName = (conn?.ebay_username as string | null) ?? null;

  if (!sellerName && accessToken) {
    try {
      const idRes = await fetchWithRetry(identityUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (idRes.ok) {
        const identity = await idRes.json();
        sellerName = identity.username ?? null;
        if (sellerName) {
          const { error } = await supabase.from('ebay_connections').update({ ebay_username: sellerName }).eq('user_id', userId);
          if (error) console.error('ebay-oauth: persisting lazy-fetched username failed', error);
        }
      }
    } catch (err) {
      console.error('ebay identity lazy-fetch failed:', err);
    }
  }
  return sellerName;
}

export type FindingItem = { itemId: string; title: string | null; sellPrice: number | null };

// P2-24: previously hard-capped at 2 pages / 200 listings — a seller with
// more active listings than that silently only got the first 200 synced.
// Now paginates up to the same configurable safety ceiling as the REST
// endpoints (ebaySyncMaxPages()) using eBay's own reported totalEntries to
// know when it's genuinely done, and reports `truncated: true` if the
// ceiling is hit first rather than claiming a complete fetch. findingPage
// strictly increases and an empty/short page always stops the loop, so a
// repeated/stuck page can't spin forever.
export async function fetchActiveListingsViaFindingApi(
  findingUrl: string,
  appId: string,
  sellerName: string,
): Promise<{ items: FindingItem[]; err: string | null; truncated: boolean }> {
  const items: FindingItem[] = [];
  let err: string | null = null;
  let findingPage = 1;
  let totalFindings = 0;
  const maxPages = ebaySyncMaxPages();
  while (findingPage <= maxPages) {
    const findUrl = `${findingUrl}?OPERATION-NAME=findItemsAdvanced&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=${encodeURIComponent(appId)}&RESPONSE-DATA-FORMAT=JSON&GLOBAL-ID=EBAY-US&itemFilter%280%29.name=Seller&itemFilter%280%29.value=${encodeURIComponent(sellerName)}&paginationInput.entriesPerPage=100&paginationInput.pageNumber=${findingPage}`;
    const findRes = await fetchWithRetry(findUrl, { headers: { Accept: 'application/json' } });
    if (!findRes.ok) {
      console.error('ebay finding-api http error:', findRes.status, await findRes.text().catch(() => ''));
      err = `HTTP ${findRes.status}`;
      return { items, err, truncated: findingPage > 1 };
    }
    const findData = await findRes.json();
    // Check for API-level errors (eBay returns HTTP 200 even for invalid requests)
    const apiError = findData?.errorMessage?.[0]?.error?.[0]?.message?.[0];
    if (apiError) {
      console.error('ebay finding-api error response:', apiError);
      return { items, err: apiError, truncated: findingPage > 1 };
    }
    const response = findData?.findItemsAdvancedResponse?.[0];
    const foundItems: Record<string, unknown>[] = (response?.searchResult?.[0]?.item ?? []) as Record<string, unknown>[];
    if (foundItems.length === 0) return { items, err, truncated: false };
    for (const fi of foundItems) {
      const itemId = ((fi.itemId as string[]) ?? [])[0] ?? null;
      const title = ((fi.title as string[]) ?? [])[0] ?? null;
      const priceVal = (fi.sellingStatus as Record<string, unknown>[] | null)?.[0];
      const currentPrice = (priceVal?.currentPrice as Record<string, string>[] | null)?.[0];
      const sellPrice = currentPrice ? parseFloat(currentPrice['__value__'] ?? '0') || null : null;
      if (!itemId) continue;
      items.push({ itemId, title, sellPrice });
      totalFindings++;
    }
    const totalEntries = parseInt(String(response?.paginationOutput?.[0]?.totalEntries?.[0] ?? '0'), 10);
    if (totalFindings >= totalEntries || foundItems.length < 100) return { items, err, truncated: false };
    findingPage++;
  }
  return { items, err, truncated: true };
}

export type RawOrder = {
  orderId?: string;
  creationDate?: string;
  lineItems?: Array<{
    sku?: string | null;
    legacyItemId?: string | null;
    title?: string | null;
    lineItemCost?: { value?: string };
  }>;
};

export async function fetchOrders(
  apiBase: string,
  headers: Record<string, string>,
  sinceIso: string,
): Promise<{ ok: boolean; status: number; orders: RawOrder[]; truncated: boolean }> {
  const { ok, status, items, truncated } = await fetchEbayPaged<RawOrder>(
    (limit, offset) =>
      `${apiBase}/sell/fulfillment/v1/order?filter=creationdate:[${sinceIso}..]&limit=${limit}&offset=${offset}`,
    headers,
    (d) => d.orders,
    (d) => d.total,
  );
  return { ok, status, orders: items, truncated };
}
