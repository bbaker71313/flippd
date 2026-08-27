// Shared Resend email helper (§4.2 dedup) — single HTML-email implementation,
// previously copied verbatim into auth, cron, and stripe-webhook.
// NOTE: export-reminder sends a plaintext email from a different "from" address and
// is intentionally left with its own implementation (different shape, not a dup).
//
// P2-27: sendEmail() now returns a structured result instead of `void` so
// callers can't accidentally treat a failed send as success, and it goes
// through the shared P2-18 externalCall policy (timeout + bounded transient
// retry + Retry-After honored). sendDurableEmail() adds a slower, DB-backed
// retry queue (see migration 20260827130000_p2_email_delivery_log.sql) for
// important transactional mail (verification, billing) that still fails
// after the immediate retries — processed by cron/index.ts.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { externalCall, ExternalCallError } from "./externalCall.ts"

export interface EmailSendResult {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
  retryable?: boolean;
}

interface ResendResponse {
  id?: string;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<EmailSendResult> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.warn('RESEND_API_KEY not set — skipping email');
    return { success: false, skipped: true, error: 'RESEND_API_KEY not configured' };
  }

  // Stable across all retry attempts for this one call (set once, outside the
  // wrapper's retry loop) so a retried send can't create a duplicate email —
  // Resend deduplicates on Idempotency-Key.
  const idempotencyKey = crypto.randomUUID();

  try {
    const data = await externalCall<ResendResponse>(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          from: Deno.env.get('RESEND_FROM_EMAIL') ?? 'ScanForProfit <hello@scanforprofit.com>',
          to: [to],
          subject,
          html,
        }),
      },
      { timeoutMs: 10_000, maxRetries: 2, isIdempotent: true },
      (res) => res.json() as Promise<ResendResponse>,
    );
    return { success: true, messageId: data.id };
  } catch (err) {
    if (err instanceof ExternalCallError) {
      // No response body/headers logged — status/kind only, never leaks the API key or recipient content.
      console.error(`sendEmail failed: kind=${err.kind} status=${err.status ?? 'n/a'} attempts=${err.attempts}`);
      return { success: false, error: `${err.kind}${err.status ? `:${err.status}` : ''}`, retryable: err.retryable };
    }
    console.error('sendEmail failed with an unexpected error:', err instanceof Error ? err.message : String(err));
    return { success: false, error: 'unexpected', retryable: false };
  }
}

export interface DurableEmailInput {
  to: string;
  subject: string;
  html: string;
  category: string;
}

/**
 * Send important transactional email (verification, billing) with a DB-backed
 * retry queue as the fallback when the immediate send (which already retries
 * transient failures itself, see sendEmail) still fails. A permanent failure
 * (e.g. invalid address) is recorded as 'dead' immediately rather than queued
 * — retrying it would never succeed.
 */
export async function sendDurableEmail(
  supabase: SupabaseClient,
  input: DurableEmailInput,
): Promise<EmailSendResult> {
  const result = await sendEmail(input.to, input.subject, input.html);
  if (result.success) return result;

  const { error: insertErr } = await supabase.from('email_delivery_log').insert({
    to_email: input.to,
    subject: input.subject,
    html: input.html,
    category: input.category,
    status: result.retryable === false ? 'dead' : 'pending',
    attempts: 1,
    last_error: result.error ?? null,
  });
  if (insertErr) {
    console.error('sendDurableEmail: failed to queue for retry:', insertErr.message);
  }
  return result;
}
