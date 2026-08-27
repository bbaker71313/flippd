// P1-I: eBay sync reconciliation — domain logic that decides how already-
// fetched, already-parsed eBay data (offers, active listings, order lines)
// gets reconciled into our `inventory` table. Provider/transport concerns
// (talking to eBay, pagination, wire-format parsing) live in ebayClient.ts;
// this module never calls `fetch`. Extracted from ebay-oauth/index.ts —
// same RPC calls, same field mappings, no behavior change.
//
// The atomic per-row concurrency guard is the `ebay_reconcile_inventory_row`/
// `ebay_reconcile_sold_order_line` Postgres RPCs (see migration
// 20260826230000_p1_ebay_sync_and_webhook_idempotency.sql) — this module's
// job is just to call them with the right arguments and aggregate results
// into a truthful per-phase status, never to duplicate their reconciliation
// rules in JS.

import type { FindingItem, RawOffer, RawOrder } from "./ebayClient.ts";

export type PhaseStatus = {
  name: string;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  count: number;
  detail?: string;
  // P2-24: true when this phase's fetch hit its pagination safety ceiling
  // before exhausting all of eBay's data — the caller must not report this
  // phase (or the overall sync) as a complete success when this is true.
  truncated?: boolean;
};

export function overallSyncStatus(phases: PhaseStatus[]): 'success' | 'partial_failure' | 'failure' {
  const relevant = phases.filter((p) => p.status !== 'skipped');
  if (relevant.length === 0) return 'success';
  if (relevant.every((p) => p.status === 'failed')) return 'failure';
  // P2-24: a phase that reconciled everything it fetched but stopped fetching
  // early (hit its pagination ceiling) is not a complete success — never
  // report a fully-synced result when data was intentionally truncated.
  if (relevant.every((p) => p.status === 'success' && !p.truncated)) return 'success';
  return 'partial_failure';
}

// ── Offers phase ─────────────────────────────────────────────────────────
// Offers with a listingId already have an eBay identity to protect — go
// through the atomic RPC (DB-enforced (user_id, ebay_item_id) uniqueness).
// Draft offers with no listingId yet have no eBay identity yet — they keep
// the prior best-effort sku-scoped upsert (sku is deliberately not a
// uniqueness boundary, per the approved relist rule). This narrow draft-only
// path is NOT protected by the same atomic guard as listed offers; see
// docs/HANDOFF.md for the accepted-risk note carried over from the P1
// remediation session that introduced it.
export async function reconcileOffersPhase(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: number,
  offers: RawOffer[],
  titleMap: Record<string, string>,
): Promise<{ active: number; drafted: number; ok: number; failed: number }> {
  let active = 0, drafted = 0, ok = 0, failed = 0;

  for (const offer of offers) {
    const isPublished = offer.status === 'PUBLISHED';
    if (isPublished) active++; else drafted++;

    const listingId: string | null = offer.listing?.listingId ?? null;
    const sellPrice: number | null = parseFloat(offer.pricingSummary?.price?.value ?? '0') || null;
    const status = isPublished ? 'Listed' : 'Unlisted';
    const rawTitle: string | null = offer.sku ? (titleMap[offer.sku] ?? null) : null;
    const title = rawTitle ? rawTitle.slice(0, 80) : null;
    const categoryId = offer.categoryId ? parseInt(String(offer.categoryId), 10) : null;

    if (listingId) {
      const { error } = await supabase.rpc('ebay_reconcile_inventory_row', {
        p_user_id: userId,
        p_ebay_item_id: listingId,
        p_sku: offer.sku ?? null,
        p_status: status,
        p_sell_price: sellPrice,
        p_title: title,
        p_category_id: categoryId,
        p_item_id_fallback: `ebay-${listingId}`,
      });
      if (error) { failed++; console.error('ebay-oauth: offers reconcile failed', error); }
      else ok++;
    } else if (offer.sku) {
      const { data: existing, error: selErr } = await supabase.from('inventory')
        .select('id').eq('user_id', userId).eq('sku', offer.sku).is('ebay_item_id', null).maybeSingle();
      if (selErr) { failed++; console.error('ebay-oauth: draft offer lookup failed', selErr); continue; }
      if (existing) {
        const { error } = await supabase.from('inventory').update({
          status,
          ...(sellPrice ? { sell_price: sellPrice } : {}),
          ...(title ? { listing_title: title } : {}),
        }).eq('id', existing.id).eq('user_id', userId);
        if (error) { failed++; console.error('ebay-oauth: draft offer update failed', error); }
        else ok++;
      } else {
        const { error } = await supabase.from('inventory').insert({
          user_id: userId,
          item_id: offer.sku,
          sku: offer.sku,
          nickname: (title ?? offer.sku).slice(0, 255),
          listing_title: title,
          sell_price: sellPrice,
          status,
          ebay_category_id: categoryId,
          platform: 'eBay',
          created_from: 'ebay_sync',
        });
        if (error) { failed++; console.error('ebay-oauth: draft offer insert failed', error); }
        else ok++;
      }
    }
  }

  return { active, drafted, ok, failed };
}

// ── Active listings phase (eBay Finding API) ────────────────────────────
export async function reconcileActiveListingsPhase(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: number,
  items: FindingItem[],
): Promise<{ active: number; ok: number; failed: number }> {
  let active = 0, ok = 0, failed = 0;
  for (const item of items) {
    const { error } = await supabase.rpc('ebay_reconcile_inventory_row', {
      p_user_id: userId,
      p_ebay_item_id: item.itemId,
      p_sku: null,
      p_status: 'Listed',
      p_sell_price: item.sellPrice,
      p_title: item.title ? item.title.slice(0, 80) : null,
      p_category_id: null,
      p_item_id_fallback: `ebay-${item.itemId}`,
    });
    if (error) { failed++; console.error('ebay-oauth: finding-api reconcile failed', error); }
    else { ok++; active++; }
  }
  return { active, ok, failed };
}

// ── Order lines phase (fulfilled orders → Sold) ─────────────────────────
// Shared by both handlePullListings' orders sub-phase and the standalone
// sync-orders handler — previously duplicated near-identically in both
// places (a P1-A/anti-drift concern: two independent copies of the same
// reconciliation decision could silently diverge). Single implementation now.
export async function reconcileOrderLines(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: number,
  orders: RawOrder[],
): Promise<{ synced: number; failed: number }> {
  let synced = 0, failed = 0;
  for (const order of orders) {
    for (const item of (order.lineItems ?? [])) {
      const orderSoldPrice = parseFloat(item.lineItemCost?.value ?? '0') || null;
      const { error } = await supabase.rpc('ebay_reconcile_sold_order_line', {
        p_user_id: userId,
        p_sku: item.sku ?? null,
        p_ebay_item_id: item.legacyItemId ?? null,
        p_title: item.title ?? (item.sku ? `eBay item ${item.sku}` : 'eBay sold item'),
        p_sold_price: orderSoldPrice,
        p_sold_at: order.creationDate ?? new Date().toISOString(),
        p_item_id_fallback: `ebay-order-${order.orderId}-${item.legacyItemId ?? ''}`,
      });
      if (error) { failed++; console.error('ebay-oauth: order reconcile failed', error); }
      else synced++;
    }
  }
  return { synced, failed };
}
