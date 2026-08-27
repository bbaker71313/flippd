// P1-K test infrastructure: a JS-side mirror of the ebay_reconcile_inventory_row
// / ebay_reconcile_sold_order_line Postgres RPCs defined in
// supabase/migrations/20260826230000_p1_ebay_sync_and_webhook_idempotency.sql.
//
// This mirror exists only because this sandbox cannot run a live Postgres —
// it is test infrastructure, NOT a second implementation of the reconciliation
// rules for production use. If that migration's SQL logic changes, this file
// must be updated to match or these tests will silently verify stale
// semantics. Kept deliberately literal (same order of operations, same
// COALESCE-style field merging) rather than "improved", specifically so it
// stays easy to diff against the SQL by eye.

import type { Row } from "./fakeSupabase.ts";

// deno-lint-ignore no-explicit-any
export function makeEbayReconcileInventoryRowHandler(getTable: () => Row[], nextId: () => number) {
  return (p: Record<string, unknown>) => {
    if (p.p_ebay_item_id == null) {
      return { data: null, error: { message: 'ebay_reconcile_inventory_row requires a non-null ebay_item_id' } };
    }
    const table = getTable();

    // (1) same listing identity already known
    const identityMatch = table.find((r) => r.user_id === p.p_user_id && r.ebay_item_id === p.p_ebay_item_id);
    if (identityMatch) {
      if (p.p_status != null) identityMatch.status = p.p_status;
      if (p.p_sell_price != null) identityMatch.sell_price = p.p_sell_price;
      if (p.p_title != null) identityMatch.listing_title = p.p_title;
      if (p.p_category_id != null) identityMatch.ebay_category_id = p.p_category_id;
      return { data: { ...identityMatch }, error: null };
    }

    // (2) unambiguous relist candidate via sku (never Sold)
    if (p.p_sku != null) {
      const skuMatches = table.filter((r) => r.user_id === p.p_user_id && r.sku === p.p_sku && r.status !== 'Sold');
      if (skuMatches.length === 1) {
        const row = skuMatches[0];
        row.ebay_item_id = p.p_ebay_item_id;
        if (p.p_status != null) row.status = p.p_status;
        if (p.p_sell_price != null) row.sell_price = p.p_sell_price;
        if (p.p_title != null) row.listing_title = p.p_title;
        if (p.p_category_id != null) row.ebay_category_id = p.p_category_id;
        return { data: { ...row }, error: null };
      }
      // 0 or >1 (ambiguous) matches — fall through to insert, never guess.
    }

    // (3) insert; ON CONFLICT (user_id, ebay_item_id) DO UPDATE mirrors the
    // unique index guard against a concurrent duplicate insert.
    const conflict = table.find((r) => r.user_id === p.p_user_id && r.ebay_item_id === p.p_ebay_item_id);
    if (conflict) {
      if (p.p_status != null) conflict.status = p.p_status;
      if (p.p_sell_price != null) conflict.sell_price = p.p_sell_price;
      return { data: { ...conflict }, error: null };
    }
    const inserted: Row = {
      id: nextId(),
      user_id: p.p_user_id,
      item_id: p.p_sku ?? p.p_item_id_fallback,
      sku: p.p_sku ?? null,
      nickname: p.p_title ?? p.p_sku ?? 'eBay item',
      listing_title: p.p_title ?? null,
      sell_price: p.p_sell_price ?? null,
      status: p.p_status ?? 'Unlisted',
      ebay_item_id: p.p_ebay_item_id,
      ebay_category_id: p.p_category_id ?? null,
      platform: 'eBay',
      created_from: 'ebay_sync',
    };
    table.push(inserted);
    return { data: { ...inserted }, error: null };
  };
}

export function makeEbayReconcileSoldOrderLineHandler(getTable: () => Row[], nextId: () => number) {
  return (p: Record<string, unknown>) => {
    const table = getTable();
    let row: Row | undefined;

    if (p.p_sku != null) {
      const candidates = table
        .filter((r) => r.user_id === p.p_user_id && r.sku === p.p_sku && r.status !== 'Sold')
        .sort((a, b) => a.id - b.id); // oldest-first surrogate for created_at ASC, id ASC
      row = candidates[0];
    }
    if (!row && p.p_ebay_item_id != null) {
      row = table.find((r) => r.user_id === p.p_user_id && r.ebay_item_id === p.p_ebay_item_id);
    }
    if (row) {
      row.status = 'Sold';
      row.sold_at = p.p_sold_at ?? new Date().toISOString();
      if (p.p_sold_price != null) row.sold_price = p.p_sold_price;
      if (p.p_ebay_item_id != null) row.ebay_item_id = p.p_ebay_item_id;
      return { data: { ...row }, error: null };
    }

    const conflict = p.p_ebay_item_id != null
      ? table.find((r) => r.user_id === p.p_user_id && r.ebay_item_id === p.p_ebay_item_id)
      : undefined;
    if (conflict) {
      conflict.status = 'Sold';
      if (p.p_sold_at != null) conflict.sold_at = p.p_sold_at;
      if (p.p_sold_price != null) conflict.sold_price = p.p_sold_price;
      return { data: { ...conflict }, error: null };
    }

    const inserted: Row = {
      id: nextId(),
      user_id: p.p_user_id,
      item_id: p.p_sku ?? p.p_item_id_fallback,
      sku: p.p_sku ?? null,
      nickname: p.p_title ?? 'eBay sold item',
      listing_title: p.p_title ?? null,
      sell_price: p.p_sold_price ?? null,
      sold_price: p.p_sold_price ?? null,
      status: 'Sold',
      ebay_item_id: p.p_ebay_item_id ?? null,
      platform: 'eBay',
      created_from: 'ebay_sync',
      sold_at: p.p_sold_at ?? new Date().toISOString(),
    };
    table.push(inserted);
    return { data: { ...inserted }, error: null };
  };
}
