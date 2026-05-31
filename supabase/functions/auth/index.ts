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

async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + 90 * 24 * 60 * 60 }));
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
