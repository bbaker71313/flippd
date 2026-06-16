import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import bcrypt from "https://esm.sh/bcryptjs"

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

async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) { console.warn('RESEND_API_KEY not set — skipping email'); return; }
  const appUrl = Deno.env.get('APP_URL') ?? 'https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/auth';
  const verifyLink = `${appUrl}/verify?token=${token}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM_EMAIL') ?? 'ScanForProfit <hello@scanforprofit.com>',
      to: [to],
      subject: 'Verify your ScanForProfit account',
      html: `<h2>Welcome to ScanForProfit!</h2><p>Click below to verify your email.</p><p><a href="${verifyLink}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Verify My Account &rarr;</a></p><p>This link expires in 24 hours. If you didn't sign up, ignore this email.</p>`,
    }),
  });
  if (!res.ok) console.error('Resend error:', await res.text());
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
    if (req.method === 'POST' && path.endsWith('/register')) return await handleRegister(req, supabase, jwtSecret);
    if (req.method === 'GET'  && path.endsWith('/verify'))   return await handleVerify(req, supabase);
    if (req.method === 'POST' && path.endsWith('/login'))    return await handleLogin(req, supabase, jwtSecret);
    if (req.method === 'GET'  && path.endsWith('/me'))       return await handleMe(req, supabase, jwtSecret);
    if (req.method === 'GET'  && path.endsWith('/ebay/connect'))    return await handleEbayConnect(req, jwtSecret);
    if (req.method === 'GET'  && path.endsWith('/ebay-callback'))   return await handleEbayCallback(req, supabase, jwtSecret);
    if (req.method === 'GET'  && path.endsWith('/ebay/status'))     return await handleEbayStatus(req, supabase, jwtSecret);
    if (req.method === 'POST' && path.endsWith('/ebay/disconnect')) return await handleEbayDisconnect(req, supabase, jwtSecret);
    if (req.method === 'POST' && path.endsWith('/reset-request'))  return await handleResetRequest(req, supabase, jwtSecret);
    if (req.method === 'POST' && path.endsWith('/reset-confirm'))  return await handleResetConfirm(req, supabase, jwtSecret);
    return json({ error: 'Not found' }, 404);
  } catch (err) {
    console.error('auth error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

async function handleRegister(req: Request, supabase: ReturnType<typeof createClient>, _secret: string) {
  const body = await req.json().catch(() => ({}));
  const { name: rawName, username, email, password } = body;
  const name = rawName ?? username;

  if (!username || !email || !password) return json({ error: 'username, email, and password are required' }, 400);
  if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return json({ error: 'Username can only contain letters, numbers, and underscores' }, 400);

  const { data: existingUser } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
  if (existingUser) return json({ error: 'Username already taken', field: 'username' }, 409);

  const { data: existingEmail } = await supabase.from('users').select('id, is_verified').eq('email', email).maybeSingle();
  if (existingEmail) {
    if (!existingEmail.is_verified) {
      const token = randomHex(32);
      const expires = new Date(Date.now() + 86400000).toISOString();
      await supabase.from('users').update({ verification_token: token, verification_token_expires: expires }).eq('id', existingEmail.id);
      await sendVerificationEmail(email, token).catch(console.error);
      return json({ error: 'An account with this email exists but is unverified. We resent your verification link.', field: 'email' }, 409);
    }
    return json({ error: 'An account with this email already exists.', field: 'email' }, 409);
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const token = randomHex(32);
  const now = new Date();

  const { error: insertErr } = await supabase.from('users').insert({
    name,
    username,
    email,
    password: passwordHash,
    is_verified: false,
    verification_token: token,
    verification_token_expires: new Date(now.getTime() + 86400000).toISOString(),
    tier: 'trial',
    trial_ends_at: new Date(now.getTime() + 7 * 86400000).toISOString(),
  });

  if (insertErr) {
    console.error('insert error:', insertErr);
    return json({ error: 'Registration failed. Please try again.' }, 500);
  }

  await sendVerificationEmail(email, token).catch(console.error);
  return json({ success: true, message: 'Check your email to verify your account before logging in.' });
}

async function handleVerify(req: Request, supabase: ReturnType<typeof createClient>) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://scanforprofit.com';

  if (!token) return Response.redirect(`${frontendUrl}?error=invalid_token`, 302);

  const { data: user } = await supabase
    .from('users')
    .select('id, is_verified, verification_token_expires')
    .eq('verification_token', token)
    .maybeSingle();

  if (!user) return Response.redirect(`${frontendUrl}?error=invalid_token`, 302);
  if (user.is_verified) return Response.redirect(`${frontendUrl}?verified=already`, 302);
  if (new Date(user.verification_token_expires) < new Date()) return Response.redirect(`${frontendUrl}?error=token_expired`, 302);

  await supabase.from('users')
    .update({ is_verified: true, verification_token: null, verification_token_expires: null })
    .eq('id', user.id);

  return Response.redirect(`${frontendUrl}?verified=true`, 302);
}

async function handleLogin(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const body = await req.json().catch(() => ({}));
  const { username, password } = body;

  if (!username || !password) return json({ error: 'Username and password are required' }, 400);

  const { data: user } = await supabase
    .from('users')
    .select('id, name, username, email, password, is_verified, tier, trial_ends_at')
    .or(`username.eq.${username},email.eq.${username}`)
    .maybeSingle();

  if (!user) return json({ error: 'Incorrect username or password' }, 401);

  const match = bcrypt.compareSync(password, user.password);
  if (!match) return json({ error: 'Incorrect username or password' }, 401);

  if (!user.is_verified) return json({ error: 'email_not_verified', message: 'Please verify your email before logging in. Check your inbox.' }, 403);

  const token = await signJWT({ sub: user.id, username: user.username, email: user.email }, jwtSecret);

  return json({
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      tier: user.tier,
      trialEndsAt: user.trial_ends_at,
    },
  });
}

async function handleMe(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  let payload: Record<string, unknown>;
  try { payload = await verifyJWT(authHeader.slice(7), jwtSecret); }
  catch { return json({ error: 'Unauthorized' }, 401); }

  const { data: user } = await supabase
    .from('users')
    .select('id, name, username, email, tier, trial_ends_at, scan_count_month, stripe_subscription_id, subscription_status, subscription_period_end')
    .eq('id', payload.sub)
    .maybeSingle();

  if (!user) return json({ error: 'User not found' }, 401);

  const scanLimits: Record<string, number | null> = { trial: null, scout: 25, hustle: null, stack: null, empire: null };
  const inventoryLimits: Record<string, number | null> = { trial: null, scout: 10, hustle: 500, stack: null, empire: null };

  return json({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    tier: user.tier,
    trialEndsAt: user.trial_ends_at,
    scansThisMonth: user.scan_count_month,
    scanLimit: scanLimits[user.tier] ?? null,
    inventoryLimit: inventoryLimits[user.tier] ?? null,
    subscription: user.stripe_subscription_id ? {
      id: user.stripe_subscription_id,
      status: user.subscription_status,
      periodEnd: user.subscription_period_end,
    } : null,
  });
}

async function handleEbayConnect(req: Request, jwtSecret: string) {
  const userId = await getAuthedUserId(req, jwtSecret);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const clientId = Deno.env.get('EBAY_CLIENT_ID');
  const ruName = Deno.env.get('EBAY_RUNAME');
  if (!clientId || !ruName) return json({ error: 'eBay integration is not configured' }, 500);

  const state = await signJWT({ sub: userId }, jwtSecret, 600);
  const authUrl = 'https://auth.ebay.com/oauth2/authorize'
    + '?client_id=' + encodeURIComponent(clientId)
    + '&response_type=code'
    + '&redirect_uri=' + encodeURIComponent(ruName)
    + '&scope=' + encodeURIComponent(EBAY_SCOPES)
    + '&state=' + encodeURIComponent(state);

  return json({ authUrl });
}

async function handleEbayCallback(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
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
  if (!clientId || !clientSecret || !ruName) return Response.redirect(`${frontendUrl}/app.html?ebay_error=not_configured`, 302);

  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: ruName,
    }),
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

async function handleEbayStatus(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
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

async function handleEbayDisconnect(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
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

async function handleResetRequest(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const body = await req.json().catch(() => ({}));
  const { email } = body;
  if (!email) return json({ error: 'Email is required' }, 400);

  const { data: user } = await supabase
    .from('users')
    .select('id, email, username')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  // Always return success to prevent email enumeration
  if (!user) return json({ success: true, message: 'If that email is registered, a reset link has been sent.' });

  const resetToken = await signJWT({ sub: user.id, purpose: 'password_reset' }, jwtSecret, 3600);
  const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://scanforprofit.com';
  const resetLink = `${frontendUrl}/app.html?reset=${resetToken}`;

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM_EMAIL') ?? 'ScanForProfit <hello@scanforprofit.com>',
        to: [user.email],
        subject: 'Reset your ScanForProfit password',
        html: `<h2>Reset your password</h2><p>Hi ${user.username},</p><p>Click below to set a new password. This link expires in 1 hour.</p><p><a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#d4a843;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Reset Password &rarr;</a></p><p>If you didn't request this, ignore this email — your password won't change.</p>`,
      }),
    }).catch(console.error);
  }

  return json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
}

async function handleResetConfirm(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const body = await req.json().catch(() => ({}));
  const { token, password } = body;
  if (!token || !password) return json({ error: 'Token and password are required' }, 400);
  if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

  let payload: Record<string, unknown>;
  try { payload = await verifyJWT(token, jwtSecret); }
  catch { return json({ error: 'Reset link has expired or is invalid. Please request a new one.' }, 400); }

  if (payload.purpose !== 'password_reset') return json({ error: 'Invalid reset token' }, 400);

  const passwordHash = bcrypt.hashSync(password, 10);
  const { error } = await supabase
    .from('users')
    .update({ password: passwordHash })
    .eq('id', payload.sub);

  if (error) return json({ error: 'Failed to update password. Please try again.' }, 500);

  return json({ success: true, message: 'Password updated successfully. Please log in.' });
}
