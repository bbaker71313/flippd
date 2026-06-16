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
  'https://api.ebay.com/oauth/api_scope/sell.finances',
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
    if (req.method === 'GET'  && path.endsWith('/authorize'))  return await handleAuthorize(req, jwtSecret);
    if (req.method === 'GET'  && path.endsWith('/callback'))   return await handleCallback(req, supabase, jwtSecret);
    if (req.method === 'GET'  && path.endsWith('/status'))     return await handleStatus(req, supabase, jwtSecret);
    if (req.method === 'POST' && path.endsWith('/disconnect')) return await handleDisconnect(req, supabase, jwtSecret);
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

  await supabase.from('users').update({
    ebay_access_token: tokenData.access_token,
    ebay_refresh_token: tokenData.refresh_token,
    ebay_token_expires_at: expiresAt,
    ebay_username: ebayUsername,
  }).eq('id', userId);

  return Response.redirect(`${frontendUrl}/app.html?ebay_connected=true`, 302);
}

async function handleStatus(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const userId = await getAuthedUserId(req, jwtSecret);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const { data: user } = await supabase
    .from('users')
    .select('ebay_access_token, ebay_username')
    .eq('id', userId)
    .maybeSingle();

  return json({
    connected: !!user?.ebay_access_token,
    username: user?.ebay_username ?? null,
  });
}

async function handleDisconnect(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const userId = await getAuthedUserId(req, jwtSecret);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  await supabase.from('users').update({
    ebay_access_token: null,
    ebay_refresh_token: null,
    ebay_token_expires_at: null,
    ebay_username: null,
  }).eq('id', userId);

  return json({ success: true });
}
