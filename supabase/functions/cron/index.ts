import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM_EMAIL') ?? 'ScanForProfit <hello@scanforprofit.com>',
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) console.error('Resend error:', await res.text());
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // SEC-004: fail closed — require CRON_SECRET to be configured and matched
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) return json({ error: 'Cron not configured' }, 503);
  const provided = req.headers.get('x-cron-secret');
  if (provided !== cronSecret) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const appUrl = Deno.env.get('FRONTEND_URL') ?? 'https://scanforprofit.com';
  const now = new Date();

  // Day-14 window: last activity was 14–15 days ago
  const day14Start = new Date(now.getTime() - 15 * 86400000).toISOString();
  const day14End   = new Date(now.getTime() - 14 * 86400000).toISOString();

  // Day-30 window: last activity was 30–31 days ago
  const day30Start = new Date(now.getTime() - 31 * 86400000).toISOString();
  const day30End   = new Date(now.getTime() - 30 * 86400000).toISOString();

  const results = { day14: 0, day30: 0, errors: 0 };

  // Day-14 re-engagement
  const { data: day14Users } = await supabase
    .from('users')
    .select('id, email, username')
    .in('tier', ['trial', 'scout'])
    .gte('last_login_at', day14Start)
    .lt('last_login_at', day14End);

  for (const user of day14Users ?? []) {
    try {
      await sendEmail(
        user.email,
        'Still looking for deals? Your scanner is waiting',
        `<h2>Hey ${user.username ?? 'there'} — it's been a while</h2>
<p>You haven't opened ScanForProfit in 2 weeks. Your next flip could be sitting on a shelf right now.</p>
<p>Resellers who scan consistently make more — every pass on a bad item is money saved, every BUY is profit waiting to happen.</p>
<p><a href="${appUrl}/app.html" style="display:inline-block;padding:12px 24px;background:#d4a843;color:#000;text-decoration:none;border-radius:6px;font-weight:bold;">Start Scanning &rarr;</a></p>
<p style="color:#888;font-size:12px;">Don't want these emails? <a href="mailto:hello@scanforprofit.com?subject=Unsubscribe">Unsubscribe</a></p>`,
      );
      results.day14++;
    } catch {
      results.errors++;
    }
  }

  // Day-30 re-engagement
  const { data: day30Users } = await supabase
    .from('users')
    .select('id, email, username')
    .in('tier', ['trial', 'scout'])
    .gte('last_login_at', day30Start)
    .lt('last_login_at', day30End);

  for (const user of day30Users ?? []) {
    try {
      await sendEmail(
        user.email,
        "Is ScanForProfit still useful to you?",
        `<h2>We miss you, ${user.username ?? 'there'}</h2>
<p>You haven't scanned in 30 days. We want to make sure ScanForProfit is actually working for you.</p>
<p>If there's something that's not clicking, hit reply and tell us — we read every email and often ship fixes within days.</p>
<p>If you're ready to get back to it:</p>
<p><a href="${appUrl}/app.html" style="display:inline-block;padding:12px 24px;background:#d4a843;color:#000;text-decoration:none;border-radius:6px;font-weight:bold;">Open the App &rarr;</a></p>
<p style="color:#888;font-size:12px;">Don't want these emails? <a href="mailto:hello@scanforprofit.com?subject=Unsubscribe">Unsubscribe</a></p>`,
      );
      results.day30++;
    } catch {
      results.errors++;
    }
  }

  console.log('Cron complete:', results);
  return json({ ok: true, ...results });
});
