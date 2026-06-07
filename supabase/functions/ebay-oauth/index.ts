import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Shared helpers (mirrors claude-proxy conventions) ───────────────────────

class HttpError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly data: Record<string, unknown> = {},
  ) { super(message); }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.finances',
  'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
].join(' ');

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function redirect(url: string) {
  return new Response(null, { status: 302, headers: { ...CORS, Location: url } });
}

// Supabase JWTs: sub = UUID string, email at top level
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

async function signState(secret: string, data: Record<string, unknown>): Promise<string> {
  const payload = btoa(JSON.stringify(data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  const sig = btoa(String.fromCharCode(...sigBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${payload}.${sig}`;
}

async function verifyState(secret: string, state: string): Promise<Record<string, unknown>> {
  const [payload, sig] = state.split('.');
  if (!payload || !sig) throw new Error('Invalid state');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload));
  if (!valid) throw new Error('Invalid state signature');
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
}

// Look up or lazily create the users row by email — bridges Supabase Auth (UUID) → integer id
async function getOrCreateUser(
  supabase: ReturnType<typeof createClient>,
  email: string,
  username: string,
): Promise<{ id: number }> {
  const { data: existing } = await supabase
    .from('users').select('id').eq('email', email).maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('users')
    .insert({ email, username: username || email.split('@')[0], password: 'supabase_auth', is_verified: true })
    .select('id').single();
  if (error || !created) throw new Error('Failed to create user');
  return created;
}

// ── eBay host selection (sandbox vs production) ─────────────────────────────

function ebayHosts(sandbox: boolean) {
  return sandbox
    ? { auth: 'https://auth.sandbox.ebay.com', api: 'https://api.sandbox.ebay.com' }
    : { auth: 'https://auth.ebay.com', api: 'https://api.ebay.com' };
}

// ── eBay token exchange / refresh ────────────────────────────────────────────

interface EbayConfig {
  appId: string;
  certId: string;
  ruName: string;
  sandbox: boolean;
}

async function exchangeCodeForTokens(cfg: EbayConfig, code: string) {
  const { api } = ebayHosts(cfg.sandbox);
  const basicAuth = btoa(`${cfg.appId}:${cfg.certId}`);
  const res = await fetch(`${api}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: cfg.ruName,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new HttpError(data.error_description ?? 'eBay token exchange failed', 502, { ebay: data });
  return data as { access_token: string; refresh_token: string; expires_in: number; refresh_token_expires_in: number };
}

async function refreshAccessToken(cfg: EbayConfig, refreshToken: string) {
  const { api } = ebayHosts(cfg.sandbox);
  const basicAuth = btoa(`${cfg.appId}:${cfg.certId}`);
  const res = await fetch(`${api}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: SCOPES,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new HttpError(data.error_description ?? 'eBay token refresh failed', 502, { ebay: data });
  return data as { access_token: string; expires_in: number };
}

async function fetchEbayUsername(cfg: EbayConfig, accessToken: string): Promise<string | null> {
  const { api } = ebayHosts(cfg.sandbox);
  try {
    const res = await fetch(`${api}/commerce/identity/v1/user/`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.username ?? null;
  } catch { return null; }
}

// Returns a valid access token, refreshing + persisting if expired.
async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  cfg: EbayConfig,
  userId: number,
): Promise<string> {
  const { data: conn } = await supabase
    .from('ebay_connections').select('*').eq('user_id', userId).maybeSingle();
  if (!conn) throw new HttpError('eBay account not connected', 409);

  if (new Date(conn.expires_at).getTime() > Date.now() + 60_000) {
    return conn.access_token;
  }

  const refreshed = await refreshAccessToken(cfg, conn.refresh_token);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase.from('ebay_connections').update({
    access_token: refreshed.access_token,
    expires_at: expiresAt,
  }).eq('user_id', userId);
  return refreshed.access_token;
}

// ── Route handlers ───────────────────────────────────────────────────────────

async function handleAuthorize(cfg: EbayConfig, jwtSecret: string, userId: number) {
  const { auth } = ebayHosts(cfg.sandbox);
  const state = await signState(jwtSecret, { userId, ts: Date.now() });
  const authUrl = `${auth}/oauth2/authorize`
    + `?client_id=${encodeURIComponent(cfg.appId)}`
    + `&response_type=code`
    + `&redirect_uri=${encodeURIComponent(cfg.ruName)}`
    + `&scope=${encodeURIComponent(SCOPES)}`
    + `&state=${encodeURIComponent(state)}`;
  return json({ authUrl });
}

async function handleCallback(
  supabase: ReturnType<typeof createClient>,
  cfg: EbayConfig,
  jwtSecret: string,
  appUrl: string,
  code: string | null,
  state: string | null,
) {
  try {
    if (!code || !state) throw new Error('Missing code or state');
    const stateData = await verifyState(jwtSecret, state);
    const userId = stateData.userId as number;

    const tokens = await exchangeCodeForTokens(cfg, code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const refreshExpiresAt = new Date(Date.now() + tokens.refresh_token_expires_in * 1000).toISOString();
    const username = await fetchEbayUsername(cfg, tokens.access_token);

    await supabase.from('ebay_connections').upsert({
      user_id: userId,
      ebay_username: username,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      refresh_expires_at: refreshExpiresAt,
    }, { onConflict: 'user_id' });

    return redirect(`${appUrl}?ebay_connected=true`);
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : (e as Error).message;
    return redirect(`${appUrl}?ebay_error=${encodeURIComponent(msg)}`);
  }
}

async function handleDisconnect(supabase: ReturnType<typeof createClient>, userId: number) {
  await supabase.from('ebay_connections').delete().eq('user_id', userId);
  return json({ ok: true });
}

async function handleStatus(supabase: ReturnType<typeof createClient>, userId: number) {
  const { data: conn } = await supabase
    .from('ebay_connections').select('ebay_username').eq('user_id', userId).maybeSingle();
  if (!conn) return json({ connected: false });
  return json({ connected: true, username: conn.ebay_username ?? undefined });
}

async function handlePullListings(
  supabase: ReturnType<typeof createClient>,
  cfg: EbayConfig,
  userId: number,
  days: number,
) {
  const accessToken = await getValidAccessToken(supabase, cfg, userId);
  const { api } = ebayHosts(cfg.sandbox);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${api}/sell/fulfillment/v1/order?filter=${encodeURIComponent(`creationdate:[${since}..]`)}&limit=50`,
    { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
  );
  const data = await res.json();
  if (!res.ok) throw new HttpError(data.errors?.[0]?.message ?? 'eBay sync failed', 502, { ebay: data });

  const orders = (data.orders ?? []) as Array<Record<string, unknown>>;
  return json({ ok: true, days, count: orders.length, orders });
}

// ── Router ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);
  // Strip the function name prefix so routes match regardless of how Supabase mounts the path
  const route = url.pathname.replace(/^\/ebay-oauth/, '') || '/';

  const jwtSecret = Deno.env.get('JWT_SECRET') ?? 'dev-secret-replace-in-production';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const cfg: EbayConfig = {
    appId: Deno.env.get('EBAY_APP_ID') ?? '',
    certId: Deno.env.get('EBAY_CERT_ID') ?? '',
    ruName: Deno.env.get('EBAY_RU_NAME') ?? '',
    sandbox: (Deno.env.get('EBAY_SANDBOX') ?? '').toLowerCase() === 'true',
  };
  const appUrl = Deno.env.get('APP_URL') ?? 'https://scanforprofit.com/app.html';

  // Public route — eBay redirects the browser here with ?code & ?state
  if (route === '/callback' && req.method === 'GET') {
    return await handleCallback(supabase, cfg, jwtSecret, appUrl, url.searchParams.get('code'), url.searchParams.get('state'));
  }

  if (!cfg.appId || !cfg.certId || !cfg.ruName) {
    return json({ error: 'eBay integration not configured' }, 503);
  }

  // All other routes require a valid Supabase session
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  const token = authHeader.slice(7);

  let payload: Record<string, unknown>;
  try { payload = await verifyJWT(token, jwtSecret); }
  catch { return json({ error: 'Unauthorized' }, 401); }

  const email = (payload.email as string) ?? '';
  const username = ((payload.user_metadata as Record<string, unknown>)?.username as string) ?? '';

  let dbUser: { id: number };
  try { dbUser = await getOrCreateUser(supabase, email, username); }
  catch (e) { return json({ error: (e as Error).message }, 500); }

  try {
    if (route === '/authorize' && req.method === 'GET') {
      return await handleAuthorize(cfg, jwtSecret, dbUser.id);
    }
    if (route === '/disconnect' && req.method === 'POST') {
      return await handleDisconnect(supabase, dbUser.id);
    }
    if (route === '/status' && req.method === 'GET') {
      return await handleStatus(supabase, dbUser.id);
    }
    if (route === '/pull-listings' && req.method === 'POST') {
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* default {} */ }
      const days = typeof body.days === 'number' ? body.days : 90;
      return await handlePullListings(supabase, cfg, dbUser.id, days);
    }
    return json({ error: 'Not found' }, 404);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...e.data }, e.httpStatus);
    return json({ error: (e as Error).message ?? 'Internal error' }, 500);
  }
});
