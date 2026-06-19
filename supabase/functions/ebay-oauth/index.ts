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
    if (req.method === 'GET'  && path.endsWith('/authorize'))     return await handleAuthorize(req, jwtSecret);
    if (req.method === 'GET'  && path.endsWith('/callback'))      return await handleCallback(req, supabase, jwtSecret);
    if (req.method === 'GET'  && path.endsWith('/status'))        return await handleStatus(req, supabase, jwtSecret);
    if (req.method === 'POST' && path.endsWith('/disconnect'))    return await handleDisconnect(req, supabase, jwtSecret);
    if (req.method === 'POST' && path.endsWith('/price-change'))  return await handlePriceChange(req, supabase, jwtSecret);
    if (req.method === 'POST' && path.endsWith('/pull-listings')) return await handlePullListings(req, supabase, jwtSecret);
    return json({ error: 'Not found' }, 404);
  } catch (err) {
    console.error('ebay-oauth error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

async function handleAuthorize(req: Request, jwtSecret: string) {
  const userId = await getAuthedUserId(req, jwtSecret);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const clientId = Deno.env.get('EBAY_CLIENT_ID');
  const ruName = Deno.env.get('EBAY_RUNAME');
  if (!clientId || !ruName) return json({ error: 'eBay integration is not configured' }, 500);

  // Short-lived state token ties the callback back to this user
  const state = await signJWT({ sub: userId }, jwtSecret, 600);
  const authUrl = 'https://auth.ebay.com/oauth2/authorize'
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
  } catch {
    return Response.redirect(`${frontendUrl}/app.html?ebay_error=invalid_state`, 302);
  }

  const clientId = Deno.env.get('EBAY_CLIENT_ID');
  const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET');
  const ruName = Deno.env.get('EBAY_RUNAME');
  if (!clientId || !clientSecret || !ruName) {
    return Response.redirect(`${frontendUrl}/app.html?ebay_error=not_configured`, 302);
  }

  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
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
    const identityRes = await fetch('https://apiz.ebay.com/commerce/identity/v1/user/', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    });
    if (identityRes.ok) {
      const identity = await identityRes.json();
      ebayUsername = identity.username ?? null;
    }
  } catch (err) {
    console.error('eBay identity lookup failed:', err);
  }

  // Tokens live in ebay_connections, not users
  await supabase.from('ebay_connections').upsert({
    user_id: userId,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: expiresAt,
    refresh_expires_at: refreshExpiresAt,
    ebay_username: ebayUsername,
    connected_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

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
  const clientId = Deno.env.get('EBAY_CLIENT_ID');
  const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET');
  if (!clientId || !clientSecret || !conn.refresh_token) return null;

  const refreshRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
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

  const ebayHeaders = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
  let active = 0, drafted = 0, sold = 0;

  // Build sku→title map from inventory items
  const titleMap: Record<string, string> = {};
  try {
    const itemsRes = await fetch('https://api.ebay.com/sell/inventory/v1/inventory_item?limit=200', { headers: ebayHeaders });
    if (itemsRes.ok) {
      const itemsData = await itemsRes.json();
      for (const item of (itemsData.inventoryItems ?? [])) {
        if (item.sku && item.product?.title) titleMap[item.sku] = item.product.title;
      }
    }
  } catch { /* title lookup is best-effort */ }

  // Pull offers (active + draft listings) and upsert to inventory
  try {
    const offersRes = await fetch('https://api.ebay.com/sell/inventory/v1/offer?limit=200', { headers: ebayHeaders });
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

  // Pull fulfilled orders (mark matching inventory items as Sold)
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const ordersRes = await fetch(
      `https://api.ebay.com/sell/fulfillment/v1/order?filter=creationdate:[${since}..]&limit=200`,
      { headers: ebayHeaders },
    );
    if (ordersRes.ok) {
      const ordersData = await ordersRes.json();
      for (const order of (ordersData.orders ?? [])) {
        for (const item of (order.lineItems ?? [])) {
          sold++;
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
            await supabase.from('inventory').update({
              status: 'Sold',
              sold_at: order.creationDate ?? new Date().toISOString(),
            }).eq('id', existing.id);
          }
        }
      }
    }
  } catch (err) {
    console.error('ebay pull-listings orders error:', err);
  }

  return json({ active, drafted, sold });
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
  const offersRes = await fetch(
    `https://api.ebay.com/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`,
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
    `https://api.ebay.com/sell/inventory/v1/offer/${offerId}`,
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
