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

const SCAN_LIMITS: Record<string, number | null> = {
  trial: null, scout: 25, hustle: null, stack: null, empire: null,
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  // Health check — no auth required
  if (body.type === 'health') {
    return json({ status: 'ok', function: 'claude-proxy', ts: new Date().toISOString() });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const token = authHeader.slice(7);
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const jwtSecret = Deno.env.get('JWT_SECRET') ?? 'dev-secret-replace-in-production';

  // When called with the anon key (e.g. smoke tests), proxy without user context
  if (token !== anonKey) {
    let payload: Record<string, unknown>;
    try { payload = await verifyJWT(token, jwtSecret); }
    catch { return json({ error: 'Unauthorized' }, 401); }

    const userId = payload.sub as number;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: user } = await supabase
      .from('users')
      .select('tier, scan_count_month, scan_reset_date')
      .eq('id', userId)
      .maybeSingle();

    if (!user) return json({ error: 'Unauthorized' }, 401);

    // Reset monthly count if needed
    const thisMonth = new Date().toISOString().slice(0, 7);
    const lastReset = (user.scan_reset_date ?? '').slice(0, 7);
    let scanCount = user.scan_count_month ?? 0;
    if (lastReset < thisMonth) {
      scanCount = 0;
      await supabase.from('users').update({
        scan_count_month: 0,
        scan_reset_date: new Date().toISOString().slice(0, 10),
      }).eq('id', userId);
    }

    const limit = SCAN_LIMITS[user.tier];
    if (limit !== null && scanCount >= limit) {
      return json({
        error: 'scan_limit_reached',
        tier: user.tier,
        limit,
        used: scanCount,
        message: `You've used all ${limit} free scans this month. Upgrade to continue scanning.`,
        upgradeUrl: '/stripe/checkout',
      }, 429);
    }

    await supabase.from('users').update({ scan_count_month: scanCount + 1 }).eq('id', userId);
  }

  // Proxy to Anthropic
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return json({ error: 'AI service not configured' }, 503);

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const responseData = await anthropicRes.json();
  return new Response(JSON.stringify(responseData), {
    status: anthropicRes.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
