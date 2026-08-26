import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { signJWT, verifyJWT, getAuthedUserIdChecked, randomHex } from "../_shared/jwt.ts"
import { corsHeaders } from "../_shared/cors.ts"

// SEC-015: handler functions call json() with no CORS; Deno.serve wraps with addCors().
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const EBAY_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
].join(' ');

function ebayUrls() {
  const sandbox = Deno.env.get('EBAY_SANDBOX') === 'true';
  return {
    auth:     sandbox ? 'https://auth.sandbox.ebay.com/oauth2/authorize'          : 'https://auth.ebay.com/oauth2/authorize',
    token:    sandbox ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'   : 'https://api.ebay.com/identity/v1/oauth2/token',
    api:      sandbox ? 'https://api.sandbox.ebay.com'                             : 'https://api.ebay.com',
    identity: sandbox ? 'https://apiz.sandbox.ebay.com/commerce/identity/v1/user/': 'https://apiz.ebay.com/commerce/identity/v1/user/',
    finding:  sandbox ? 'https://svcs.sandbox.ebay.com/services/search/FindingService/v1' : 'https://svcs.ebay.com/services/search/FindingService/v1',
  };
}

// P1-A: narrowly-scoped retry for this sync only — bounded exponential
// backoff, transient failures only (network error, 429, 5xx). Never retries
// permanent failures (400/401/403/other 4xx/validation errors) per the
// approved eBay retry policy (DECISIONS.md / remediation prompt).
async function fetchWithRetry(
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

// P1-A: one phase of a multi-phase sync (offers, active listings, orders).
// A sync is only reported "success" overall when every phase here succeeded —
// never silently collapse a failed phase into an overall success.
type PhaseStatus = {
  name: string;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  count: number;
  detail?: string;
};

function overallSyncStatus(phases: PhaseStatus[]): 'success' | 'partial_failure' | 'failure' {
  const relevant = phases.filter((p) => p.status !== 'skipped');
  if (relevant.length === 0) return 'success';
  if (relevant.every((p) => p.status === 'failed')) return 'failure';
  if (relevant.every((p) => p.status === 'success')) return 'success';
  return 'partial_failure';
}

function ebayCreds() {
  const sandbox = Deno.env.get('EBAY_SANDBOX') === 'true';
  return {
    clientId:     Deno.env.get(sandbox ? 'EBAY_SANDBOX_CLIENT_ID'     : 'EBAY_CLIENT_ID'),
    clientSecret: Deno.env.get(sandbox ? 'EBAY_SANDBOX_CLIENT_SECRET' : 'EBAY_CLIENT_SECRET'),
    ruName:       Deno.env.get(sandbox ? 'EBAY_SANDBOX_RUNAME'        : 'EBAY_RUNAME'),
  };
}

Deno.serve(async (req: Request) => {
  // SEC-015: addCors injects dynamic locked-origin CORS onto every response,
  // including those returned from handler functions that call the module-level json().
  const addCors = (res: Response): Response => {
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(corsHeaders(req))) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  // SEC-015 CSRF guard: non-simple header forces CORS preflight; cross-site requests cannot set it.
  if (req.method !== 'GET') {
    if (!req.headers.get('x-sfp-client')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }
  }

  const url = new URL(req.url);
  const path = url.pathname;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const jwtSecret = Deno.env.get('JWT_SECRET');
  if (!jwtSecret) throw new Error('JWT_SECRET must be set');

  try {
    if (req.method === 'GET'  && path.endsWith('/authorize'))     return addCors(await handleAuthorize(req, supabase, jwtSecret));
    if (req.method === 'GET'  && path.endsWith('/callback'))      return addCors(await handleCallback(req, supabase, jwtSecret));
    if (req.method === 'GET'  && path.endsWith('/status'))        return addCors(await handleStatus(req, supabase, jwtSecret));
    if (req.method === 'POST' && path.endsWith('/disconnect'))    return addCors(await handleDisconnect(req, supabase, jwtSecret));
    if (req.method === 'POST' && path.endsWith('/price-change'))   return addCors(await handlePriceChange(req, supabase, jwtSecret));
    if (req.method === 'POST' && path.endsWith('/pull-listings'))  return addCors(await handlePullListings(req, supabase, jwtSecret));
    if (req.method === 'POST' && path.endsWith('/create-listing')) return addCors(await handleCreateListing(req, supabase, jwtSecret));
    if (req.method === 'POST' && path.endsWith('/sync-orders'))    return addCors(await handleSyncOrders(req, supabase, jwtSecret));
    return addCors(json({ error: 'Not found' }, 404));
  } catch (err) {
    console.error('ebay-oauth error:', err);
    return addCors(json({ error: 'Internal server error' }, 500));
  }
});

async function handleAuthorize(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const userId = await getAuthedUserIdChecked(req, jwtSecret, supabase);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const { clientId, ruName } = ebayCreds();
  if (!clientId || !ruName) return json({ error: 'eBay integration is not configured' }, 500);

  // Nonce stored in users table — always has a row for any authenticated user.
  // ebay_connections may not have a row yet (first connect), and its access_token/
  // refresh_token columns are NOT NULL with no default, so a nonce-only INSERT fails.
  // users.ebay_oauth_nonce was added in migration 008 and is always safe to UPDATE.
  const nonce = randomHex(16);
  const nonceExpiresAt = new Date(Date.now() + 600_000).toISOString();

  const { error: nonceErr } = await supabase.from('users').update({
    ebay_oauth_nonce: nonce,
    ebay_oauth_nonce_expires_at: nonceExpiresAt,
  }).eq('id', userId);

  if (nonceErr) {
    console.error('ebay-oauth: nonce store failed', nonceErr);
    return json({ error: 'Failed to initiate eBay connection. Try again.' }, 500);
  }

  const state = await signJWT({ sub: userId, nonce }, jwtSecret, 600);
  const authUrl = ebayUrls().auth
    + '?client_id=' + encodeURIComponent(clientId)
    + '&response_type=code'
    + '&redirect_uri=' + encodeURIComponent(ruName)
    + '&scope=' + encodeURIComponent(EBAY_SCOPES)
    + '&state=' + encodeURIComponent(state);

  return json({ authUrl });
}

async function handleCallback(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const url = new URL(req.url);
  const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://scanforprofit.com';
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const ebayError = url.searchParams.get('error');

  if (ebayError) return Response.redirect(`${frontendUrl}/app.html?ebay_error=${encodeURIComponent(ebayError)}`, 302);
  if (!code || !state) return Response.redirect(`${frontendUrl}/app.html?ebay_error=missing_code`, 302);

  let userId: number;
  try {
    const payload = await verifyJWT(state, jwtSecret);
    userId = payload.sub as number;
    const jwtNonce = payload.nonce as string;

    // Verify nonce from users table (same table used in handleAuthorize).
    // ebay_connections may not exist yet for this user; users row always exists.
    const { data: userRow } = await supabase
      .from('users')
      .select('ebay_oauth_nonce, ebay_oauth_nonce_expires_at')
      .eq('id', userId)
      .maybeSingle();

    const storedNonce = userRow?.ebay_oauth_nonce;
    const nonceExpiry = userRow?.ebay_oauth_nonce_expires_at
      ? new Date(userRow.ebay_oauth_nonce_expires_at)
      : new Date(0);

    if (!storedNonce || storedNonce !== jwtNonce || nonceExpiry < new Date()) {
      console.error('ebay-oauth: state_mismatch', {
        hasNonce: !!storedNonce,
        matches: storedNonce === jwtNonce,
        expired: nonceExpiry < new Date(),
        userId,
      });
      return Response.redirect(`${frontendUrl}/app.html?ebay_error=state_mismatch`, 302);
    }

    // Clear nonce — single use only
    await supabase.from('users').update({
      ebay_oauth_nonce: null,
      ebay_oauth_nonce_expires_at: null,
    }).eq('id', userId);
  } catch {
    return Response.redirect(`${frontendUrl}/app.html?ebay_error=invalid_state`, 302);
  }

  const { clientId, clientSecret, ruName } = ebayCreds();
  if (!clientId || !clientSecret || !ruName) {
    return Response.redirect(`${frontendUrl}/app.html?ebay_error=not_configured`, 302);
  }

  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const tokenRes = await fetch(ebayUrls().token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: ruName }),
  });

  if (!tokenRes.ok) {
    console.error('eBay token exchange failed:', await tokenRes.text());
    return Response.redirect(`${frontendUrl}/app.html?ebay_error=token_exchange_failed`, 302);
  }

  const tokenData = await tokenRes.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  // eBay refresh tokens are valid for 18 months
  const refreshExpiresAt = new Date(Date.now() + 548 * 24 * 60 * 60 * 1000).toISOString();

  let ebayUsername: string | null = null;
  try {
    const identityRes = await fetch(ebayUrls().identity, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    });
    if (identityRes.ok) {
      const identity = await identityRes.json();
      ebayUsername = identity.username ?? null;
      console.log('eBay identity lookup success, username:', ebayUsername);
    } else {
      const errBody = await identityRes.text().catch(() => '');
      console.error('eBay identity lookup non-ok:', identityRes.status, errBody);
    }
  } catch (err) {
    console.error('eBay identity lookup failed:', err);
  }

  // Tokens are encrypted at rest (SEC-010). ebay_store_tokens upserts on user_id and
  // armors access/refresh with a Vault-held key inside the DB — plaintext never persisted.
  const { error: tokenUpsertErr } = await supabase.rpc('ebay_store_tokens', {
    p_user_id: userId,
    p_access: tokenData.access_token,
    p_refresh: tokenData.refresh_token,
    p_expires: expiresAt,
    p_refresh_expires: refreshExpiresAt,
    p_username: ebayUsername,
  });

  if (tokenUpsertErr) {
    console.error('ebay-oauth: token upsert failed', tokenUpsertErr);
    return Response.redirect(`${frontendUrl}/app.html?ebay_error=token_save_failed`, 302);
  }

  return Response.redirect(`${frontendUrl}/app.html?ebay_connected=true`, 302);
}

async function handleStatus(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const userId = await getAuthedUserIdChecked(req, jwtSecret, supabase);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  // Connection status needs only row existence + username (not a secret), so it reads
  // the plaintext columns directly and never decrypts the tokens (SEC-010).
  const { data: conn } = await supabase
    .from('ebay_connections')
    .select('ebay_username')
    .eq('user_id', userId)
    .maybeSingle();

  return json({
    connected: !!conn,
    username: conn?.ebay_username ?? null,
  });
}

async function handleDisconnect(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const userId = await getAuthedUserIdChecked(req, jwtSecret, supabase);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  await supabase.from('ebay_connections').delete().eq('user_id', userId);

  return json({ success: true });
}

async function getValidEbayToken(
  userId: number,
  supabase: ReturnType<typeof createClient>,
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

async function handlePullListings(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const userId = await getAuthedUserIdChecked(req, jwtSecret, supabase);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const days = typeof body.days === 'number' ? Math.max(1, Math.min(365, body.days)) : 90;

  const accessToken = await getValidEbayToken(userId, supabase);
  if (!accessToken) return json({ error: 'eBay not connected — connect in Settings' }, 400);

  const { api: apiBase, identity: identityUrl, finding: findingUrl } = ebayUrls();
  const ebayHeaders = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
  let active = 0, drafted = 0, sold = 0, clientIdMissing = false;
  let findingSellerName: string | null = null, findingApiErr: string | null = null;
  const phases: PhaseStatus[] = [];

  // Build sku→title map from inventory items (best-effort enrichment only —
  // never a reason to fail a phase).
  const titleMap: Record<string, string> = {};
  try {
    const itemsRes = await fetchWithRetry(`${apiBase}/sell/inventory/v1/inventory_item?limit=200`, { headers: ebayHeaders });
    if (itemsRes.ok) {
      const itemsData = await itemsRes.json();
      for (const item of (itemsData.inventoryItems ?? [])) {
        if (item.sku && item.product?.title) titleMap[item.sku] = item.product.title;
      }
    }
  } catch { /* title lookup is best-effort */ }

  // ── Phase: offers (API-created active + draft listings) ──────────────────
  // P1-A: reconciliation for every offer that already has an eBay listing
  // identity goes through the atomic RPC (DB-enforced (user_id, ebay_item_id)
  // uniqueness — repeated/concurrent syncs can never duplicate a row here).
  // Draft offers with no listing id yet have no eBay identity to protect —
  // they keep the prior best-effort sku-scoped upsert (sku is deliberately
  // not a uniqueness boundary, per the approved relist rule).
  {
    let offersOk = 0, offersFailed = 0;
    try {
      const offersRes = await fetchWithRetry(`${apiBase}/sell/inventory/v1/offer?limit=200`, { headers: ebayHeaders });
      if (offersRes.ok) {
        const offersData = await offersRes.json();
        for (const offer of (offersData.offers ?? [])) {
          const isPublished = offer.status === 'PUBLISHED';
          if (isPublished) active++; else drafted++;

          const listingId: string | null = offer.listing?.listingId ?? null;
          const sellPrice: number | null = parseFloat(offer.pricingSummary?.price?.value ?? '0') || null;
          const status = isPublished ? 'Listed' : 'Unlisted';
          const rawTitle: string | null = offer.sku ? (titleMap[offer.sku] ?? null) : null;
          const title = rawTitle ? rawTitle.slice(0, 80) : null;
          const categoryId = offer.categoryId ? parseInt(String(offer.categoryId), 10) : null;

          if (listingId) {
            const { error } = await supabase.rpc('ebay_reconcile_inventory_row', {
              p_user_id: userId,
              p_ebay_item_id: listingId,
              p_sku: offer.sku ?? null,
              p_status: status,
              p_sell_price: sellPrice,
              p_title: title,
              p_category_id: categoryId,
              p_item_id_fallback: `ebay-${listingId}`,
            });
            if (error) { offersFailed++; console.error('ebay-oauth: offers reconcile failed', error); }
            else offersOk++;
          } else if (offer.sku) {
            const { data: existing, error: selErr } = await supabase.from('inventory')
              .select('id').eq('user_id', userId).eq('sku', offer.sku).is('ebay_item_id', null).maybeSingle();
            if (selErr) { offersFailed++; console.error('ebay-oauth: draft offer lookup failed', selErr); continue; }
            if (existing) {
              const { error } = await supabase.from('inventory').update({
                status,
                ...(sellPrice ? { sell_price: sellPrice } : {}),
                ...(title ? { listing_title: title } : {}),
              }).eq('id', existing.id).eq('user_id', userId);
              if (error) { offersFailed++; console.error('ebay-oauth: draft offer update failed', error); }
              else offersOk++;
            } else {
              const { error } = await supabase.from('inventory').insert({
                user_id: userId,
                item_id: offer.sku,
                sku: offer.sku,
                nickname: (title ?? offer.sku).slice(0, 255),
                listing_title: title,
                sell_price: sellPrice,
                status,
                ebay_category_id: categoryId,
                platform: 'eBay',
                created_from: 'ebay_sync',
              });
              if (error) { offersFailed++; console.error('ebay-oauth: draft offer insert failed', error); }
              else offersOk++;
            }
          }
        }
        phases.push({ name: 'offers', status: offersFailed === 0 ? 'success' : (offersOk > 0 ? 'partial' : 'failed'), count: offersOk, detail: offersFailed ? `${offersFailed} row(s) failed to reconcile` : undefined });
      } else {
        phases.push({ name: 'offers', status: 'failed', count: 0, detail: `eBay offers API HTTP ${offersRes.status}` });
      }
    } catch (err) {
      console.error('ebay pull-listings offers error:', err);
      phases.push({ name: 'offers', status: 'failed', count: offersOk, detail: String((err as Error)?.message ?? err) });
    }
  }

  // ── Phase: active listings via eBay Finding API ───────────────────────────
  // The Inventory API above only shows API-created items. The Finding API
  // returns ALL active listings regardless of how they were created —
  // traditional eBay.com listings show up here too. Uses EBAY_CLIENT_ID.
  {
    let findingOk = 0, findingFailed = 0;
    try {
      const { data: conn } = await supabase
        .from('ebay_connections')
        .select('ebay_username')
        .eq('user_id', userId)
        .maybeSingle();
      let sellerName = conn?.ebay_username as string | null;
      findingSellerName = sellerName;

      // If username wasn't captured during OAuth (identity API may have failed),
      // fetch it now using the already-valid access token and persist it so
      // future syncs don't need this fallback.
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

      findingSellerName = sellerName;
      const appId = ebayCreds().clientId;
      if (!appId) {
        clientIdMissing = true;
        console.warn('ebay finding-api: client ID not set — active listings will not sync');
      }
      if (sellerName && appId) {
        let findingPage = 1;
        let totalFindings = 0;
        while (findingPage <= 2) { // max 200 listings (2 pages × 100)
          const findUrl = `${findingUrl}?OPERATION-NAME=findItemsAdvanced&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=${encodeURIComponent(appId)}&RESPONSE-DATA-FORMAT=JSON&GLOBAL-ID=EBAY-US&itemFilter%280%29.name=Seller&itemFilter%280%29.value=${encodeURIComponent(sellerName)}&paginationInput.entriesPerPage=100&paginationInput.pageNumber=${findingPage}`;
          const findRes = await fetchWithRetry(findUrl, { headers: { Accept: 'application/json' } });
          if (!findRes.ok) {
            console.error('ebay finding-api http error:', findRes.status, await findRes.text().catch(() => ''));
            findingApiErr = `HTTP ${findRes.status}`;
            break;
          }
          const findData = await findRes.json();
          // Check for API-level errors (eBay returns HTTP 200 even for invalid requests)
          const apiError = findData?.errorMessage?.[0]?.error?.[0]?.message?.[0];
          if (apiError) { findingApiErr = apiError; console.error('ebay finding-api error response:', apiError); break; }
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
            const { error } = await supabase.rpc('ebay_reconcile_inventory_row', {
              p_user_id: userId,
              p_ebay_item_id: itemId,
              p_sku: null,
              p_status: 'Listed',
              p_sell_price: sellPrice,
              p_title: title ? title.slice(0, 80) : null,
              p_category_id: null,
              p_item_id_fallback: `ebay-${itemId}`,
            });
            if (error) { findingFailed++; console.error('ebay-oauth: finding-api reconcile failed', error); }
            else { findingOk++; active++; }
            totalFindings++;
          }
          const totalEntries = parseInt(String(response?.paginationOutput?.[0]?.totalEntries?.[0] ?? '0'), 10);
          if (totalFindings >= totalEntries || foundItems.length < 100) break;
          findingPage++;
        }
      }
      const skipped = !sellerName || !appId;
      phases.push({
        name: 'active_listings',
        status: skipped ? 'skipped' : (findingApiErr && findingOk === 0 ? 'failed' : (findingFailed > 0 ? 'partial' : 'success')),
        count: findingOk,
        detail: findingApiErr ?? (clientIdMissing ? 'EBAY_CLIENT_ID not configured' : undefined),
      });
    } catch (err) {
      console.error('ebay finding-api error:', err);
      phases.push({ name: 'active_listings', status: 'failed', count: findingOk, detail: String((err as Error)?.message ?? err) });
    }
  }

  // ── Phase: fulfilled orders (mark matching inventory items as Sold) ──────
  {
    let ordersOk = 0, ordersFailed = 0;
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const ordersRes = await fetchWithRetry(
        `${apiBase}/sell/fulfillment/v1/order?filter=creationdate:[${since}..]&limit=200`,
        { headers: ebayHeaders },
      );
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        for (const order of (ordersData.orders ?? [])) {
          for (const item of (order.lineItems ?? [])) {
            const orderSoldPrice = parseFloat((item.lineItemCost as Record<string, string> | null)?.value ?? '0') || null;
            const { error } = await supabase.rpc('ebay_reconcile_sold_order_line', {
              p_user_id: userId,
              p_sku: item.sku ?? null,
              p_ebay_item_id: item.legacyItemId ?? null,
              p_title: (item.title as string | null) ?? (item.sku ? `eBay item ${item.sku}` : 'eBay sold item'),
              p_sold_price: orderSoldPrice,
              p_sold_at: order.creationDate ?? new Date().toISOString(),
              p_item_id_fallback: `ebay-order-${order.orderId}-${item.legacyItemId ?? ''}`,
            });
            if (error) { ordersFailed++; console.error('ebay-oauth: order reconcile failed', error); }
            else { ordersOk++; sold++; }
          }
        }
        phases.push({ name: 'orders', status: ordersFailed === 0 ? 'success' : (ordersOk > 0 ? 'partial' : 'failed'), count: ordersOk, detail: ordersFailed ? `${ordersFailed} order line(s) failed to reconcile` : undefined });
      } else {
        phases.push({ name: 'orders', status: 'failed', count: 0, detail: `eBay orders API HTTP ${ordersRes.status}` });
      }
    } catch (err) {
      console.error('ebay pull-listings orders error:', err);
      phases.push({ name: 'orders', status: 'failed', count: ordersOk, detail: String((err as Error)?.message ?? err) });
    }
  }

  return json({
    active, drafted, sold, clientIdMissing,
    status: overallSyncStatus(phases),
    phases,
    debug: { totalOffers: active + drafted, totalOrders: sold, findingSellerName, findingApiErr, sandbox: Deno.env.get('EBAY_SANDBOX') === 'true' },
  });
}

async function handlePriceChange(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const userId = await getAuthedUserIdChecked(req, jwtSecret, supabase);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const { sku, newPrice } = body as { sku?: string; newPrice?: number };
  if (!sku || typeof newPrice !== 'number' || newPrice <= 0) {
    return json({ error: 'Missing or invalid sku / newPrice' }, 400);
  }

  const accessToken = await getValidEbayToken(userId, supabase);
  if (!accessToken) return json({ error: 'eBay not connected' }, 400);

  // Find offer by SKU
  const { api: priceApiBase } = ebayUrls();
  const offersRes = await fetch(
    `${priceApiBase}/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
  );

  if (offersRes.status === 404) return json({ error: 'No eBay listing found for this SKU' }, 404);
  if (!offersRes.ok) return json({ error: 'eBay API error: ' + offersRes.status }, 502);

  const offersData = await offersRes.json();
  const offer = offersData.offers?.[0];
  if (!offer) return json({ error: 'No eBay listing found for this SKU' }, 404);

  // Build update body — strip read-only fields
  const { offerId, status, listing, ...writeableOffer } = offer;
  const updateBody = {
    ...writeableOffer,
    pricingSummary: {
      ...offer.pricingSummary,
      price: {
        value: newPrice.toFixed(2),
        currency: offer.pricingSummary?.price?.currency ?? 'USD',
      },
    },
  };

  const updateRes = await fetch(
    `${priceApiBase}/sell/inventory/v1/offer/${offerId}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updateBody),
    },
  );

  if (!updateRes.ok) {
    const errText = await updateRes.text().catch(() => '');
    console.error('eBay updateOffer failed:', updateRes.status, errText);
    return json({ error: 'eBay price update failed' }, 502);
  }

  return json({ success: true, offerId, newPrice });
}
const EBAY_COND: Record<string, string> = { 'New': 'NEW', 'Like New': 'LIKE_NEW', 'Open Box': 'NEW_OTHER', 'Good': 'USED_GOOD', 'Used': 'USED_GOOD', 'Fair': 'USED_ACCEPTABLE', 'Poor': 'FOR_PARTS_OR_NOT_WORKING' };
async function handleCreateListing(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const userId = await getAuthedUserIdChecked(req, jwtSecret, supabase);
  if (!userId) return json({ error: 'Unauthorized' }, 401);
  const { inventoryId } = await req.json().catch(() => ({})) as { inventoryId?: number };
  if (!inventoryId) return json({ error: 'Missing inventoryId' }, 400);
  const { data: item } = await supabase.from('inventory').select('*').eq('id', inventoryId).eq('user_id', userId).maybeSingle();
  if (!item) return json({ error: 'Item not found' }, 404);
  if (!item.sell_price) return json({ error: 'Set a sell price before listing on eBay' }, 400);
  const accessToken = await getValidEbayToken(userId, supabase);
  if (!accessToken) return json({ error: 'eBay not connected — connect in Settings' }, 400);
  const { api: createApiBase } = ebayUrls();
  const h = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Language': 'en-US' };
  const sku = (item.sku as string | null) || `sfp-${item.id}`;
  const title = ((item.listing_title || item.nickname || 'Item for sale') as string).slice(0, 80);
  const desc  = ((item.listing_description || item.notes || title) as string).slice(0, 4000);
  const cond  = EBAY_COND[(item.condition as string) ?? ''] ?? 'USED_GOOD';
  const imgs  = (Array.isArray(item.photos) ? (item.photos as string[]) : []).slice(0, 12);
  await fetch(`${createApiBase}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    method: 'PUT', headers: h,
    body: JSON.stringify({ product: { title, description: desc, ...(imgs.length ? { imageUrls: imgs } : {}) }, condition: cond, availability: { shipToLocationAvailability: { quantity: 1 } } }),
  });
  const locR = await (await fetch(`${createApiBase}/sell/inventory/v1/location`, { headers: h })).json() as Record<string, unknown>;
  let locKey = (locR.locations as Array<Record<string, unknown>>)?.[0]?.merchantLocationKey as string | undefined;
  if (!locKey) {
    await fetch(`${createApiBase}/sell/inventory/v1/location/sfp-default`, { method: 'POST', headers: h, body: JSON.stringify({ merchantLocationStatus: 'ENABLED', name: 'ScanForProfit', location: { address: { country: 'US' } } }) });
    locKey = 'sfp-default';
  }
  const offerListR = await (await fetch(`${createApiBase}/sell/inventory/v1/offer?limit=1`, { headers: h })).json() as Record<string, unknown>;
  let policies = (offerListR.offers as Array<Record<string, unknown>>)?.[0]?.listingPolicies as Record<string, unknown> | undefined;

  if (!policies) {
    // No existing offer to borrow from — fetch policies from Account API directly
    const [ffR, pmR, rtR] = await Promise.all([
      fetch(`${createApiBase}/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US`, { headers: h }).then(r => r.json()).catch(() => ({})),
      fetch(`${createApiBase}/sell/account/v1/payment_policy?marketplace_id=EBAY_US`, { headers: h }).then(r => r.json()).catch(() => ({})),
      fetch(`${createApiBase}/sell/account/v1/return_policy?marketplace_id=EBAY_US`, { headers: h }).then(r => r.json()).catch(() => ({})),
    ]) as [Record<string, unknown>, Record<string, unknown>, Record<string, unknown>];
    const ffId = (ffR.fulfillmentPolicies as Array<Record<string, unknown>>)?.[0]?.fulfillmentPolicyId as string | undefined;
    const pmId = (pmR.paymentPolicies as Array<Record<string, unknown>>)?.[0]?.paymentPolicyId as string | undefined;
    const rtId = (rtR.returnPolicies as Array<Record<string, unknown>>)?.[0]?.returnPolicyId as string | undefined;
    if (ffId && pmId && rtId) policies = { fulfillmentPolicyId: ffId, paymentPolicyId: pmId, returnPolicyId: rtId };
  }

  if (!policies) return json({ error: 'eBay Business Policies not found. In eBay Seller Hub → Account → Business Policies, create at least one Shipping, Payment, and Return policy, then try again.' }, 400);
  const catId = item.ebay_category_id ? String(item.ebay_category_id) : '20082';
  const offerRes = await fetch(`${createApiBase}/sell/inventory/v1/offer`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ sku, marketplaceId: 'EBAY_US', format: 'FIXED_PRICE', availableQuantity: 1, categoryId: catId, listingDescription: desc, listingPolicies: policies, merchantLocationKey: locKey, pricingSummary: { price: { currency: 'USD', value: Number(item.sell_price).toFixed(2) } } }),
  });
  if (!offerRes.ok) {
    const e = await offerRes.json().catch(() => ({})) as Record<string, unknown>;
    return json({ error: (e.errors as Array<Record<string, unknown>>)?.[0]?.message ?? 'Failed to create eBay offer' }, 502);
  }
  const { offerId } = await offerRes.json() as { offerId: string };
  const pubRes = await fetch(`${createApiBase}/sell/inventory/v1/offer/${offerId}/publish`, { method: 'POST', headers: h });
  if (!pubRes.ok) {
    const e = await pubRes.json().catch(() => ({})) as Record<string, unknown>;
    return json({ error: (e.errors as Array<Record<string, unknown>>)?.[0]?.message ?? 'Failed to publish eBay listing' }, 502);
  }
  const { listingId } = await pubRes.json() as { listingId: string };
  const { error: linkErr } = await supabase.from('inventory')
    .update({ status: 'Listed', ebay_item_id: listingId, listed_at: new Date().toISOString() })
    .eq('id', inventoryId).eq('user_id', userId);
  if (linkErr) {
    // The eBay listing was already published at this point — surface the DB
    // failure rather than silently reporting success with an unlinked row.
    console.error('ebay-oauth: linking new listing to inventory row failed', linkErr);
    return json({ listingId, listingUrl: `https://www.ebay.com/itm/${listingId}`, warning: 'Listing created on eBay but failed to link to inventory — refresh and sync to reconcile.' }, 200);
  }
  return json({ listingId, listingUrl: `https://www.ebay.com/itm/${listingId}` });
}

async function handleSyncOrders(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const userId = await getAuthedUserIdChecked(req, jwtSecret, supabase);
  if (!userId) return json({ error: 'Unauthorized' }, 401);
  const accessToken = await getValidEbayToken(userId, supabase);
  if (!accessToken) return json({ error: 'eBay not connected — connect in Settings' }, 400);
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { api: syncApiBase } = ebayUrls();
  const ordersRes = await fetchWithRetry(`${syncApiBase}/sell/fulfillment/v1/order?filter=creationdate:[${since}..]&limit=200`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
  if (!ordersRes.ok) return json({ error: 'eBay orders API error: ' + ordersRes.status }, 502);
  const { orders = [] } = await ordersRes.json() as { orders?: Array<Record<string, unknown>> };
  const ordersFound = orders.length;
  console.log(`handleSyncOrders: userId=${userId} ordersFound=${ordersFound}`);
  // P1-A: same atomic reconciliation RPC as pull-listings' orders phase — a
  // repeated/concurrent sync-orders call can never duplicate a Sold row.
  let synced = 0, failed = 0;
  for (const order of orders) {
    for (const li of (order.lineItems ?? []) as Array<Record<string, unknown>>) {
      const soldPrice = parseFloat((li.lineItemCost as Record<string, string> | null)?.value ?? '0') || null;
      const { error } = await supabase.rpc('ebay_reconcile_sold_order_line', {
        p_user_id: userId,
        p_sku: (li.sku as string | null) ?? null,
        p_ebay_item_id: (li.legacyItemId as string | null) ?? null,
        p_title: (li.title as string | null) ?? (li.sku ? `eBay item ${li.sku}` : 'eBay sold item'),
        p_sold_price: soldPrice,
        p_sold_at: (order.creationDate as string) ?? new Date().toISOString(),
        p_item_id_fallback: `ebay-order-${order.orderId}-${li.legacyItemId ?? ''}`,
      });
      if (error) { failed++; console.error('ebay-oauth: sync-orders reconcile failed', error); }
      else synced++;
    }
  }
  const status: 'success' | 'partial_failure' | 'failure' = failed === 0 ? 'success' : (synced > 0 ? 'partial_failure' : 'failure');
  return json({ synced, status, debug: { ordersFound, ordersApiStatus: ordersRes.status, failed } });
}
