import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { sendEmail } from "../_shared/sendEmail.ts"
import { corsHeaders } from "../_shared/cors.ts"

interface PendingEmailRow {
  id: string;
  to_email: string;
  subject: string;
  html: string;
  attempts: number;
  max_attempts: number;
}

// P2-27: bounded durable retry for important transactional email (verification,
// billing) queued by sendDurableEmail() when its immediate send attempt failed.
// Runs on this function's existing schedule — no new scheduler wiring needed.
// deno-lint-ignore no-explicit-any
export async function processEmailQueue(
  supabase: any,
): Promise<{ processed: number; sent: number; requeued: number; dead: number }> {
  const results = { processed: 0, sent: 0, requeued: 0, dead: 0 };
  const { data: due } = await supabase
    .from('email_delivery_log')
    .select('id, to_email, subject, html, attempts, max_attempts')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(25);

  for (const row of (due ?? []) as PendingEmailRow[]) {
    results.processed++;
    const outcome = await sendEmail(row.to_email, row.subject, row.html);
    const nowIso = new Date().toISOString();

    if (outcome.success) {
      await supabase.from('email_delivery_log')
        .update({ status: 'sent', provider_message_id: outcome.messageId ?? null, updated_at: nowIso })
        .eq('id', row.id);
      results.sent++;
      continue;
    }

    const attempts = row.attempts + 1;
    if (attempts >= row.max_attempts || outcome.retryable === false) {
      await supabase.from('email_delivery_log')
        .update({ status: 'dead', attempts, last_error: outcome.error ?? null, updated_at: nowIso })
        .eq('id', row.id);
      results.dead++;
    } else {
      const backoffMinutes = Math.min(180, 15 * attempts);
      await supabase.from('email_delivery_log')
        .update({
          attempts,
          last_error: outcome.error ?? null,
          next_attempt_at: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
          updated_at: nowIso,
        })
        .eq('id', row.id);
      results.requeued++;
    }
  }

  return results;
}

async function handleCronRequest(req: Request): Promise<Response> {
  // SEC-015: local json closes over req for dynamic locked-origin CORS.
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
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

  const emailQueue = await processEmailQueue(supabase);

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
    const outcome = await sendEmail(
      user.email,
      'Still looking for deals? Your scanner is waiting',
      `<h2>Hey ${user.username ?? 'there'} — it's been a while</h2>
<p>You haven't opened ScanForProfit in 2 weeks. Your next flip could be sitting on a shelf right now.</p>
<p>Resellers who scan consistently make more — every pass on a bad item is money saved, every BUY is profit waiting to happen.</p>
<p><a href="${appUrl}/app.html" style="display:inline-block;padding:12px 24px;background:#d4a843;color:#000;text-decoration:none;border-radius:6px;font-weight:bold;">Start Scanning &rarr;</a></p>
<p style="color:#888;font-size:12px;">Don't want these emails? <a href="mailto:hello@scanforprofit.com?subject=Unsubscribe">Unsubscribe</a></p>`,
    );
    if (outcome.success) results.day14++;
    else results.errors++;
  }

  // Day-30 re-engagement
  const { data: day30Users } = await supabase
    .from('users')
    .select('id, email, username')
    .in('tier', ['trial', 'scout'])
    .gte('last_login_at', day30Start)
    .lt('last_login_at', day30End);

  for (const user of day30Users ?? []) {
    const outcome = await sendEmail(
      user.email,
      "Is ScanForProfit still useful to you?",
      `<h2>We miss you, ${user.username ?? 'there'}</h2>
<p>You haven't scanned in 30 days. We want to make sure ScanForProfit is actually working for you.</p>
<p>If there's something that's not clicking, hit reply and tell us — we read every email and often ship fixes within days.</p>
<p>If you're ready to get back to it:</p>
<p><a href="${appUrl}/app.html" style="display:inline-block;padding:12px 24px;background:#d4a843;color:#000;text-decoration:none;border-radius:6px;font-weight:bold;">Open the App &rarr;</a></p>
<p style="color:#888;font-size:12px;">Don't want these emails? <a href="mailto:hello@scanforprofit.com?subject=Unsubscribe">Unsubscribe</a></p>`,
    );
    if (outcome.success) results.day30++;
    else results.errors++;
  }

  console.log('Cron complete:', { ...results, emailQueue });
  return json({ ok: true, ...results, emailQueue });
}

if (import.meta.main) {
  Deno.serve(handleCronRequest);
}
