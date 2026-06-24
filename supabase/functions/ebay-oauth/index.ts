import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}


function b64url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJWT(payload: Record<string, unknown>, secret: string, expiresInSeconds = 90 * 24 * 60 * 60): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${header}.${body}.${sigB64}`;
}

async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown>> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [header, payload, sig] = parts;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const sigBytes = Uint8Array.from(
    atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)
  );
  const valid = await crypto.subtle.verify(
    'HMAC', key, sigBytes, new TextEncoder().encode(`${header}.${payload}`)
  );
  if (!valid) throw new Error('Invalid signature');
  const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  if (data.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return data;
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

function ebayCreds() {
  const sandbox = Deno.env.get('EBAY_SANDBOX') === 'true';
  return {
    clientId:     Deno.env.get(sandbox ? 'EBAY_SANDBOX_CLIENT_ID'     : 'EBAY_CLIENT_ID'),
    clientSecret: Deno.env.get(sandbox ? 'EBAY_SANDBOX_CLIENT_SECRET' : 'EBAY_CLIENT_SECRET'),
    ruName:       Deno.env.get(sandbox ? 'EBAY_SANDBOX_RUNAME'        : 'EBAY_RUNAME'),
  };
}

async function getAuthedUserId(req: Request, jwtSecret: string): Promise<number | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const payload = await verifyJWT(authHeader.slice(7), jwtSecret);
    return payload.sub as number;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);
  const path = url.pathname;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const jwtSecret = Deno.env.get('JWT_SECRET') ?? 'dev-secret-replace-in-production';

  try {
    if (req.method === 'GET'  && path.endsWith('/authorize'))     return await handleAuthorize(req, supabase, jwtSecret);
    if (req.method === 'GET'  && path.endsWith('/callback'))      return await handleCallback(req, supabase, jwtSecret);
    if (req.method === 'GET'  && path.endsWith('/status'))        return await handleStatus(req, supabase, jwtSecret);
    if (req.method === 'POST' && path.endsWith('/disconnect'))    return await handleDisconnect(req, supabase, jwtSecret);
    if (req.method === 'POST' && path.endsWith('/price-change'))   return await handlePriceChange(req, supabase, jwtSecret);
    if (req.method === 'POST' && path.endsWith('/pull-listings'))  return await handlePullListings(req, supabase, jwtSecret);
    if (req.method === 'POST' && path.endsWith('/create-listing')) return await handleCreateListing(req, supabase, jwtSecret);
    if (req.method === 'POST' && path.endsWith('/sync-orders'))    return await handleSyncOrders(req, supabase, jwtSecret);
    return json({ error: 'Not found' }, 404);
  } catch (err) {
    console.error('ebay-oauth error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

async function handleAuthorize(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const userId = await getAuthedUserId(req, jwtSecret);
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

  // Tokens live in ebay_connections. All NOT NULL columns supplied so INSERT succeeds
  // for first-time connections (no prior row). username may be null if identity lookup failed.
  const { error: tokenUpsertErr } = await supabase.from('ebay_connections').upsert({
    user_id: userId,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: expiresAt,
    refresh_expires_at: refreshExpiresAt,
    ebay_username: ebayUsername,
    connected_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (tokenUpsertErr) {
    console.error('ebay-oauth: token upsert failed', tokenUpsertErr);
    return Response.redirect(`${frontendUrl}/app.html?ebay_error=token_save_failed`, 302);
  }

  return Response.redirect(`${frontendUrl}/app.html?ebay_connected=true`, 302);
}

async function handleStatus(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const userId = await getAuthedUserId(req, jwtSecret);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const { data: conn } = await supabase
    .from('ebay_connections')
    .select('access_token, ebay_username')
    .eq('user_id', userId)
    .maybeSingle();

  return json({
    connected: !!conn?.access_token,
    username: conn?.ebay_username ?? null,
  });
}

async function handleDisconnect(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const userId = await getAuthedUserId(req, jwtSecret);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  await supabase.from('ebay_connections').delete().eq('user_id', userId);

  return json({ success: true });
}

async function getValidEbayToken(
  userId: number,
  supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  const { data: conn } = await supabase
    .from('ebay_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

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

  await supabase.from('ebay_connections').update({
    access_token: refreshData.access_token,
    expires_at: newExpires,
  }).eq('user_id', userId);

  return refreshData.access_token;
}

async function handlePullListings(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const userId = await getAuthedUserId(req, jwtSecret);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const days = typeof body.days === 'number' ? Math.max(1, Math.min(365, body.days)) : 90;

  const accessToken = await getValidEbayToken(userId, supabase);
  if (!accessToken) return json({ error: 'eBay not connected — connect in Settings' }, 400);

  const { api: apiBase, identity: identityUrl, finding: findingUrl } = ebayUrls();
  const ebayHeaders = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
  let active = 0, drafted = 0, sold = 0, clientIdMissing = false;

  // Build sku→title map from inventory items
  const titleMap: Record<string, string> = {};
  try {
    const itemsRes = await fetch(`${apiBase}/sell/inventory/v1/inventory_item?limit=200`, { headers: ebayHeaders });
    if (itemsRes.ok) {
      const itemsData = await itemsRes.json();
      for (const item of (itemsData.inventoryItems ?? [])) {
        if (item.sku && item.product?.title) titleMap[item.sku] = item.product.title;
      }
    }
  } catch { /* title lookup is best-effort */ }

  // Pull offers (active + draft listings) and upsert to inventory
  try {
    const offersRes = await fetch(`${apiBase}/sell/inventory/v1/offer?limit=200`, { headers: ebayHeaders });
    if (offersRes.ok) {
      const offersData = await offersRes.json();
      for (const offer of (offersData.offers ?? [])) {
        const isPublished = offer.status === 'PUBLISHED';
        if (isPublished) active++; else drafted++;

        const listingId: string | null = offer.listing?.listingId ?? null;
        const sellPrice: number | null = parseFloat(offer.pricingSummary?.price?.value ?? '0') || null;
        const status = isPublished ? 'Listed' : 'Unlisted';
        const title: string | null = offer.sku ? (titleMap[offer.sku] ?? null) : null;

        // Find existing row by ebay_item_id, then by sku
        let existing: { id: number } | null = null;
        if (listingId) {
          const { data } = await supabase.from('inventory').select('id').eq('user_id', userId).eq('ebay_item_id', listingId).maybeSingle();
          existing = data;
        }
        if (!existing && offer.sku) {
          const { data } = await supabase.from('inventory').select('id').eq('user_id', userId).eq('sku', offer.sku).maybeSingle();
          existing = data;
        }

        if (existing) {
          const update: Record<string, unknown> = { status };
          if (sellPrice) update.sell_price = sellPrice;
          if (listingId) update.ebay_item_id = listingId;
          if (title) update.listing_title = title.slice(0, 80);
          await supabase.from('inventory').update(update).eq('id', existing.id);
        } else if (offer.sku || listingId) {
          await supabase.from('inventory').insert({
            user_id: userId,
            item_id: offer.sku ?? `ebay-${listingId}`,
            sku: offer.sku ?? null,
            nickname: (title ?? offer.sku ?? 'eBay item').slice(0, 255),
            listing_title: title ? title.slice(0, 80) : null,
            sell_price: sellPrice,
            status,
            ebay_item_id: listingId,
            ebay_category_id: offer.categoryId ? parseInt(String(offer.categoryId), 10) : null,
            platform: 'eBay',
            created_from: 'ebay_sync',
          });
        }
      }
    }
  } catch (err) {
    console.error('ebay pull-listings offers error:', err);
  }

  // Pull ALL active listings via eBay Finding API (findItemsAdvanced with Seller filter).
  // The Inventory API above only shows API-created items. The Finding API
  // returns ALL active listings regardless of how they were created — traditional
  // eBay.com listings show up here too. Uses EBAY_CLIENT_ID (app credentials).
  try {
    const { data: conn } = await supabase
      .from('ebay_connections')
      .select('ebay_username')
      .eq('user_id', userId)
      .maybeSingle();
    let sellerName = conn?.ebay_username as string | null;

    // If username wasn't captured during OAuth (identity API may have failed),
    // fetch it now using the already-valid access token and persist it so
    // future syncs don't need this fallback.
    if (!sellerName && accessToken) {
      try {
        const idRes = await fetch(identityUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (idRes.ok) {
          const identity = await idRes.json();
          sellerName = identity.username ?? null;
          if (sellerName) {
            await supabase.from('ebay_connections').update({ ebay_username: sellerName }).eq('user_id', userId);
          }
        }
      } catch (err) {
        console.error('ebay identity lazy-fetch failed:', err);
      }
    }

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
        const findRes = await fetch(findUrl, { headers: { Accept: 'application/json' } });
        if (!findRes.ok) {
          console.error('ebay finding-api http error:', findRes.status, await findRes.text().catch(() => ''));
          break;
        }
        const findData = await findRes.json();
        // Check for API-level errors (eBay returns HTTP 200 even for invalid requests)
        const apiError = findData?.errorMessage?.[0]?.error?.[0]?.message?.[0];
        if (apiError) { console.error('ebay finding-api error response:', apiError); break; }
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
          // Skip if already imported via Inventory API (would already be in inventory)
          const { data: existing } = await supabase
            .from('inventory').select('id').eq('user_id', userId).eq('ebay_item_id', itemId).maybeSingle();
          if (existing) {
            await supabase.from('inventory').update({ status: 'Listed', ...(sellPrice ? { sell_price: sellPrice } : {}) }).eq('id', existing.id);
            active++;
          } else {
            await supabase.from('inventory').insert({
              user_id: userId,
              item_id: `ebay-${itemId}`,
              nickname: (title ?? `eBay item ${itemId}`).slice(0, 255),
              listing_title: (title ?? `eBay item ${itemId}`).slice(0, 80),
              sell_price: sellPrice,
              status: 'Listed',
              ebay_item_id: itemId,
              platform: 'eBay',
              created_from: 'ebay_sync',
            });
            active++;
          }
          totalFindings++;
        }
        const totalEntries = parseInt(String(response?.paginationOutput?.[0]?.totalEntries?.[0] ?? '0'), 10);
        if (totalFindings >= totalEntries || foundItems.length < 100) break;
        findingPage++;
      }
    }
  } catch (err) {
    console.error('ebay finding-api error:', err);
  }

  // Pull fulfilled orders (mark matching inventory items as Sold)
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const ordersRes = await fetch(
      `${apiBase}/sell/fulfillment/v1/order?filter=creationdate:[${since}..]&limit=200`,
      { headers: ebayHeaders },
    );
    if (ordersRes.ok) {
      const ordersData = await ordersRes.json();
      for (const order of (ordersData.orders ?? [])) {
        for (const item of (order.lineItems ?? [])) {
          let existing: { id: number } | null = null;
          if (item.sku) {
            const { data } = await supabase.from('inventory').select('id').eq('user_id', userId).eq('sku', item.sku).maybeSingle();
            existing = data;
          }
          if (!existing && item.legacyItemId) {
            const { data } = await supabase.from('inventory').select('id').eq('user_id', userId).eq('ebay_item_id', item.legacyItemId).maybeSingle();
            existing = data;
          }
          if (existing) {
            const orderSoldPrice = parseFloat((item.lineItemCost as Record<string, string> | null)?.value ?? '0') || null;
            await supabase.from('inventory').update({
              status: 'Sold',
              sold_at: order.creationDate ?? new Date().toISOString(),
              ...(orderSoldPrice ? { sold_price: orderSoldPrice } : {}),
            }).eq('id', existing.id);
            sold++;
          } else {
            // No matching inventory row — insert a new Sold item from order data
            const title = (item.title as string | null) ?? (item.sku ? `eBay item ${item.sku}` : 'eBay sold item');
            const soldPrice = parseFloat((item.lineItemCost as Record<string, string> | null)?.value ?? '0') || null;
            await supabase.from('inventory').insert({
              user_id: userId,
              item_id: item.sku ?? `ebay-order-${order.orderId}-${item.legacyItemId ?? ''}`,
              sku: item.sku ?? null,
              nickname: title.slice(0, 255),
              listing_title: title.slice(0, 80),
              sell_price: soldPrice,
              sold_price: soldPrice,
              status: 'Sold',
              ebay_item_id: item.legacyItemId ?? null,
              platform: 'eBay',
              created_from: 'ebay_sync',
              sold_at: order.creationDate ?? new Date().toISOString(),
            });
            sold++;
          }
        }
      }
    }
  } catch (err) {
    console.error('ebay pull-listings orders error:', err);
  }

  return json({ active, drafted, sold, clientIdMissing, debug: { totalOffers: active + drafted, totalOrders: sold } });
}

async function handlePriceChange(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const userId = await getAuthedUserId(req, jwtSecret);
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
  const userId = await getAuthedUserId(req, jwtSecret);
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
  await supabase.from('inventory').update({ status: 'Listed', ebay_item_id: listingId, listed_at: new Date().toISOString() }).eq('id', inventoryId);
  return json({ listingId, listingUrl: `https://www.ebay.com/itm/${listingId}` });
}

async function handleSyncOrders(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const userId = await getAuthedUserId(req, jwtSecret);
  if (!userId) return json({ error: 'Unauthorized' }, 401);
  const accessToken = await getValidEbayToken(userId, supabase);
  if (!accessToken) return json({ error: 'eBay not connected — connect in Settings' }, 400);
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { api: syncApiBase } = ebayUrls();
  const ordersRes = await fetch(`${syncApiBase}/sell/fulfillment/v1/order?filter=creationdate:[${since}..]&limit=200`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
  if (!ordersRes.ok) return json({ error: 'eBay orders API error: ' + ordersRes.status }, 502);
  const { orders = [] } = await ordersRes.json() as { orders?: Array<Record<string, unknown>> };
  const ordersFound = orders.length;
  console.log(`handleSyncOrders: userId=${userId} ordersFound=${ordersFound}`);
  let synced = 0;
  for (const order of orders) {
    for (const li of (order.lineItems ?? []) as Array<Record<string, unknown>>) {
      const soldPrice = parseFloat((li.lineItemCost as Record<string, string> | null)?.value ?? '0') || null;
      let row: { id: number } | null = null;
      if (li.sku) { const { data: d } = await supabase.from('inventory').select('id').eq('user_id', userId).eq('sku', li.sku as string).maybeSingle(); row = d; }
      if (!row && li.legacyItemId) { const { data: d } = await supabase.from('inventory').select('id').eq('user_id', userId).eq('ebay_item_id', li.legacyItemId as string).maybeSingle(); row = d; }
      if (row) {
        await supabase.from('inventory').update({ status: 'Sold', sold_at: (order.creationDate as string) ?? new Date().toISOString(), sold_price: soldPrice }).eq('id', row.id);
        synced++;
      } else {
        // No local inventory row — insert a new Sold item so the sync is never 0 for real orders
        const title = (li.title as string | null) ?? (li.sku ? `eBay item ${li.sku}` : 'eBay sold item');
        await supabase.from('inventory').insert({
          user_id: userId,
          item_id: (li.sku as string | null) ?? `ebay-order-${order.orderId}-${li.legacyItemId ?? ''}`,
          sku: (li.sku as string | null) ?? null,
          nickname: title.slice(0, 255),
          listing_title: title.slice(0, 80),
          sell_price: soldPrice,
          sold_price: soldPrice,
          status: 'Sold',
          ebay_item_id: (li.legacyItemId as string | null) ?? null,
          platform: 'eBay',
          created_from: 'ebay_sync',
          sold_at: (order.creationDate as string) ?? new Date().toISOString(),
        });
        synced++;
      }
    }
  }
  return json({ synced, debug: { ordersFound, ordersApiStatus: ordersRes.status } });
}
