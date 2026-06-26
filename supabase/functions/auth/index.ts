import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import bcrypt from "https://esm.sh/bcryptjs"
import { signJWT, verifyJWT, getAuthedUserIdChecked } from "../_shared/jwt.ts"
import { sendEmail } from "../_shared/sendEmail.ts"
import { SCAN_LIMITS, ITEM_LIMITS } from "../_shared/tierLimits.ts"

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

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

// SEC-011 — IP-based rate limiting for auth endpoints.
function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

async function rateLimitOk(
  supabase: ReturnType<typeof createClient>,
  bucket: string, max: number, windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_bucket: bucket, p_max: max, p_window_seconds: windowSeconds,
  });
  // Fail open on infra error — a broken limiter must not lock everyone out.
  if (error) { console.error('rate limit check failed:', error); return true; }
  return data === true;
}


async function sendVerificationEmail(to: string, token: string): Promise<void> {
  // Use SUPABASE_URL (always set in Edge Functions) so the verify link always hits the auth
  // function regardless of what APP_URL or FRONTEND_URL are set to in secrets.
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'https://dqgfpchkheznvanfgsmx.supabase.co';
  const verifyLink = `${supabaseUrl}/functions/v1/auth/verify?token=${token}`;
  await sendEmail(
    to,
    'Verify your ScanForProfit account',
    `<h2>Welcome to ScanForProfit!</h2><p>Click below to verify your email.</p><p><a href="${verifyLink}" style="display:inline-block;padding:12px 24px;background:#d4a843;color:#000;text-decoration:none;border-radius:6px;font-weight:bold;">Verify My Account &rarr;</a></p><p>This link expires in 24 hours. If you didn't sign up, ignore this email.</p>`,
  );
}

async function sendWelcomeEmail(to: string, username: string): Promise<void> {
  const appUrl = Deno.env.get('FRONTEND_URL') ?? 'https://scanforprofit.com';
  await sendEmail(
    to,
    'You\'re in — start scanning for profit',
    `<h2>Your account is verified, ${username}!</h2>
<p>You're on a 7-day free trial with unlimited scans. Here's what to do first:</p>
<ol>
  <li>Open the app and tap <strong>Scout</strong></li>
  <li>Point your camera at any item at a thrift store or garage sale</li>
  <li>Get an instant BUY / HOT / PASS decision with real profit math</li>
</ol>
<p><a href="${appUrl}/app.html" style="display:inline-block;padding:12px 24px;background:#d4a843;color:#000;text-decoration:none;border-radius:6px;font-weight:bold;">Start Scanning &rarr;</a></p>
<p style="color:#888;font-size:12px;">Questions? Reply to this email — we read every one.</p>`,
  );
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
  const jwtSecret = Deno.env.get('JWT_SECRET');
  if (!jwtSecret) throw new Error('JWT_SECRET must be set');

  try {
    if (req.method === 'POST' && path.endsWith('/register')) return await handleRegister(req, supabase, jwtSecret);
    if (req.method === 'GET'  && path.endsWith('/verify'))   return await handleVerify(req, supabase);
    if (req.method === 'POST' && path.endsWith('/login'))    return await handleLogin(req, supabase, jwtSecret);
    if (req.method === 'GET'  && path.endsWith('/me'))       return await handleMe(req, supabase, jwtSecret);
    if (req.method === 'POST' && path.endsWith('/reset-request'))  return await handleResetRequest(req, supabase, jwtSecret);
    if (req.method === 'POST' && path.endsWith('/reset-confirm'))  return await handleResetConfirm(req, supabase, jwtSecret);
    if (req.method === 'PATCH' && path.endsWith('/settings'))      return await handleSaveSettings(req, supabase, jwtSecret);
    return json({ error: 'Not found' }, 404);
  } catch (err) {
    console.error('auth error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

async function handleRegister(req: Request, supabase: ReturnType<typeof createClient>, _secret: string) {
  if (!await rateLimitOk(supabase, `register:${clientIp(req)}`, 5, 3600)) return json({ error: 'Too many attempts. Please try again later.' }, 429);
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
  // Always redirect to app.html so the user lands on the login screen with feedback
  const appUrl = `${frontendUrl}/app.html`;

  if (!token) return Response.redirect(`${appUrl}?error=invalid_token`, 302);

  const { data: user } = await supabase
    .from('users')
    .select('id, is_verified, verification_token_expires')
    .eq('verification_token', token)
    .maybeSingle();

  if (!user) return Response.redirect(`${appUrl}?error=invalid_token`, 302);
  if (user.is_verified) return Response.redirect(`${appUrl}?verified=already`, 302);
  if (new Date(user.verification_token_expires) < new Date()) return Response.redirect(`${appUrl}?error=token_expired`, 302);

  const { data: verifiedUser } = await supabase.from('users')
    .update({ is_verified: true, verification_token: null, verification_token_expires: null })
    .eq('id', user.id)
    .select('email, username')
    .maybeSingle();

  if (verifiedUser) {
    sendWelcomeEmail(verifiedUser.email, verifiedUser.username).catch(console.error);
  }

  return Response.redirect(`${appUrl}?verified=true`, 302);
}

async function handleLogin(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  if (!await rateLimitOk(supabase, `login:${clientIp(req)}`, 10, 900)) return json({ error: 'Too many login attempts. Please try again in a few minutes.' }, 429);
  const body = await req.json().catch(() => ({}));
  const { username, password } = body;

  if (!username || !password) return json({ error: 'Username and password are required' }, 400);

  // SEC-005: parameterized .eq() lookups — never interpolate user input into .or() filter strings
  const COLS = 'id, name, username, email, password, is_verified, tier, trial_ends_at, token_version';
  let { data: user } = await supabase
    .from('users')
    .select(COLS)
    .eq('username', username)
    .maybeSingle();
  if (!user) {
    ({ data: user } = await supabase
      .from('users')
      .select(COLS)
      .eq('email', username)
      .maybeSingle());
  }

  if (!user) return json({ error: 'Incorrect username or password' }, 401);

  const match = bcrypt.compareSync(password, user.password);
  if (!match) return json({ error: 'Incorrect username or password' }, 401);

  if (!user.is_verified) return json({ error: 'email_not_verified', message: 'Please verify your email before logging in. Check your inbox.' }, 403);

  await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);

  const token = await signJWT({ sub: user.id, username: user.username, email: user.email, token_version: user.token_version ?? 0 }, jwtSecret);

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
    .select('id, name, username, email, tier, trial_ends_at, scan_count_month, stripe_subscription_id, subscription_status, subscription_period_end, token_version')
    .eq('id', payload.sub)
    .maybeSingle();

  if (!user) return json({ error: 'User not found' }, 401);

  // SEC-012 — reject sessions issued before the last password reset.
  if ((payload.token_version ?? 0) !== (user.token_version ?? 0)) return json({ error: 'Unauthorized' }, 401);

  const { data: settings } = await supabase
    .from('settings')
    .select('export_reminder_enabled, export_reminder_time')
    .eq('user_id', user.id)
    .maybeSingle();

  return json({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    tier: user.tier,
    trialEndsAt: user.trial_ends_at,
    scansThisMonth: user.scan_count_month,
    scanLimit: SCAN_LIMITS[user.tier] ?? null,
    inventoryLimit: ITEM_LIMITS[user.tier] ?? null,
    subscription: user.stripe_subscription_id ? {
      id: user.stripe_subscription_id,
      status: user.subscription_status,
      periodEnd: user.subscription_period_end,
    } : null,
    exportReminderEnabled: settings?.export_reminder_enabled ?? false,
    exportReminderTime: (settings?.export_reminder_time as string | null)?.slice(0, 5) ?? '09:00',
  });
}

async function handleSaveSettings(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  const userId = await getAuthedUserIdChecked(req, jwtSecret, supabase);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = { user_id: userId };

  if (typeof body.exportReminderEnabled === 'boolean') update.export_reminder_enabled = body.exportReminderEnabled;
  if (typeof body.exportReminderTime === 'string' && /^\d{2}:\d{2}$/.test(body.exportReminderTime)) {
    update.export_reminder_time = body.exportReminderTime;
  }

  if (Object.keys(update).length <= 1) return json({ error: 'No valid fields' }, 400);

  const { error } = await supabase
    .from('settings')
    .upsert(update, { onConflict: 'user_id' });

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

async function handleResetRequest(req: Request, supabase: ReturnType<typeof createClient>, jwtSecret: string) {
  if (!await rateLimitOk(supabase, `reset:${clientIp(req)}`, 5, 3600)) return json({ error: 'Too many attempts. Please try again later.' }, 429);
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
  // Fragment (#) keeps the token out of server logs, Referer headers, and proxy access logs
  const resetLink = `${frontendUrl}/app.html#reset=${resetToken}`;

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
  // SEC-012 — bump token_version to invalidate all existing JWTs for this user.
  const { data: current } = await supabase
    .from('users').select('token_version').eq('id', payload.sub).maybeSingle();
  const { error } = await supabase
    .from('users')
    .update({ password: passwordHash, token_version: ((current?.token_version as number) ?? 0) + 1 })
    .eq('id', payload.sub);

  if (error) return json({ error: 'Failed to update password. Please try again.' }, 500);

  return json({ success: true, message: 'Password updated successfully. Please log in.' });
}
