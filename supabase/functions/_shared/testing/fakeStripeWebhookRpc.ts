// P1-K test infrastructure: a JS-side mirror of the claim_stripe_webhook_event
// / complete_stripe_webhook_event Postgres RPCs defined in
// supabase/migrations/20260826230000_p1_ebay_sync_and_webhook_idempotency.sql.
// See fakeEbayReconcileRpc.ts's header for why this mirror exists and its
// coupling risk (must be kept in sync with the SQL by hand).

import type { Row } from "./fakeSupabase.ts";

export function makeClaimStripeWebhookEventHandler(getTable: () => Row[]) {
  return (p: Record<string, unknown>) => {
    const table = getTable();
    const row = table.find((r) => r.id === p.p_event_id);
    if (!row) {
      table.push({ id: p.p_event_id, event_type: p.p_event_type, status: 'processing', error_detail: null });
      return { data: 'claimed', error: null };
    }
    if (row.status === 'failed') {
      row.status = 'processing';
      row.error_detail = null;
      return { data: 'claimed', error: null };
    }
    if (row.status === 'succeeded') return { data: 'already_succeeded', error: null };
    return { data: 'in_progress', error: null };
  };
}

export function makeCompleteStripeWebhookEventHandler(getTable: () => Row[]) {
  return (p: Record<string, unknown>) => {
    const table = getTable();
    const row = table.find((r) => r.id === p.p_event_id);
    if (row) {
      row.status = p.p_success ? 'succeeded' : 'failed';
      row.error_detail = p.p_error ?? null;
    }
    return { data: null, error: null };
  };
}
