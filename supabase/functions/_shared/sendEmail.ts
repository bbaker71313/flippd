// Shared Resend email helper (§4.2 dedup) — single HTML-email implementation,
// previously copied verbatim into auth, cron, and stripe-webhook.
// NOTE: export-reminder sends a plaintext email from a different "from" address and
// is intentionally left with its own implementation (different shape, not a dup).

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) { console.warn('RESEND_API_KEY not set — skipping email'); return; }
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
