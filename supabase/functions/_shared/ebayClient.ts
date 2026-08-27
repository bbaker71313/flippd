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

  const expiresAt = conn.expires_at ? new Date(conn.expires_at) : new Date(0);
  if (expiresAt > new Date(Date.now() + 60_000)) return conn.access_token;

  // Token expired — refresh it
  const { clientId, clientSecret } = ebayCreds();
  if (!clientId || !clientSecret || !conn.refresh_token) return null;

  const refreshRes = await fetch(ebayUrls().token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refresh_token }),
  });

  if (!refreshRes.ok) return null;

  const refreshData = await refreshRes.json();
  const newExpires = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

  await supabase.rpc('ebay_update_access_token', {
    p_user_id: userId,
    p_access: refreshData.access_token,
    p_expires: newExpires,
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

// Best-effort sku->title enrichment for offers. Never a reason to fail a
// phase — swallow errors and return whatever was gathered (possibly empty).
export async function fetchInventoryTitleMap(
  apiBase: string,
  headers: Record<string, string>,
): Promise<Record<string, string>> {
  const titleMap: Record<string, string> = {};
  try {
    const itemsRes = await fetchWithRetry(`${apiBase}/sell/inventory/v1/inventory_item?limit=200`, { headers });
    if (itemsRes.ok) {
      const itemsData = await itemsRes.json();
      for (const item of (itemsData.inventoryItems ?? [])) {
        if (item.sku && item.product?.title) titleMap[item.sku] = item.product.title;
      }
    }
  } catch { /* title lookup is best-effort */ }
  return titleMap;
}

export async function fetchOffers(
  apiBase: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; status: number; offers: RawOffer[] }> {
  const offersRes = await fetchWithRetry(`${apiBase}/sell/inventory/v1/offer?limit=200`, { headers });
  if (!offersRes.ok) return { ok: false, status: offersRes.status, offers: [] };
  const offersData = await offersRes.json();
  return { ok: true, status: offersRes.status, offers: offersData.offers ?? [] };
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

// Paginates the Finding API (max 200 listings / 2 pages, matching the
// pre-P1-I behavior) and returns a flat, already-parsed item list. Pure
// transport/parsing — no DB access, no reconciliation decisions.
export async function fetchActiveListingsViaFindingApi(
  findingUrl: string,
  appId: string,
  sellerName: string,
): Promise<{ items: FindingItem[]; err: string | null }> {
  const items: FindingItem[] = [];
  let err: string | null = null;
  let findingPage = 1;
  let totalFindings = 0;
  while (findingPage <= 2) { // max 200 listings (2 pages × 100)
    const findUrl = `${findingUrl}?OPERATION-NAME=findItemsAdvanced&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=${encodeURIComponent(appId)}&RESPONSE-DATA-FORMAT=JSON&GLOBAL-ID=EBAY-US&itemFilter%280%29.name=Seller&itemFilter%280%29.value=${encodeURIComponent(sellerName)}&paginationInput.entriesPerPage=100&paginationInput.pageNumber=${findingPage}`;
    const findRes = await fetchWithRetry(findUrl, { headers: { Accept: 'application/json' } });
    if (!findRes.ok) {
      console.error('ebay finding-api http error:', findRes.status, await findRes.text().catch(() => ''));
      err = `HTTP ${findRes.status}`;
      break;
    }
    const findData = await findRes.json();
    // Check for API-level errors (eBay returns HTTP 200 even for invalid requests)
    const apiError = findData?.errorMessage?.[0]?.error?.[0]?.message?.[0];
    if (apiError) { err = apiError; console.error('ebay finding-api error response:', apiError); break; }
    const response = findData?.findItemsAdvancedResponse?.[0];
    const foundItems: Record<string, unknown>[] = (response?.searchResult?.[0]?.item ?? []) as Record<string, unknown>[];
    if (foundItems.length === 0) break;
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
    if (totalFindings >= totalEntries || foundItems.length < 100) break;
    findingPage++;
  }
  return { items, err };
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
): Promise<{ ok: boolean; status: number; orders: RawOrder[] }> {
  const ordersRes = await fetchWithRetry(
    `${apiBase}/sell/fulfillment/v1/order?filter=creationdate:[${sinceIso}..]&limit=200`,
    { headers },
  );
  if (!ordersRes.ok) return { ok: false, status: ordersRes.status, orders: [] };
  const ordersData = await ordersRes.json();
  return { ok: true, status: ordersRes.status, orders: ordersData.orders ?? [] };
}
