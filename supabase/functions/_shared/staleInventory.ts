// P2-23: stale-listing age must be measured from when an item was actually
// listed (listed_at), not when it was added to inventory (created_at) — the
// two are different aging clocks. Unlisted items only have created_at and
// keep using it. Extracted as a pure function (used by claude-proxy's Growth
// Agent staleness pull) so it's testable without mocking the AI/DB pipeline.

export interface StaleCandidateRow {
  sku: string | null;
  nickname: string | null;
  status: string;
  created_at: string;
  listed_at: string | null;
}

export interface StaleInventoryItem {
  sku: string;
  nickname: string;
  days: number;
}

export function computeStaleInventoryItems(
  rows: StaleCandidateRow[],
  maxDays: number,
  nowMs: number = Date.now(),
  limit = 5,
): StaleInventoryItem[] {
  const cutoffMs = nowMs - maxDays * 86400000;

  return rows
    .map((r) => ({
      sku: r.sku ?? '',
      nickname: r.nickname ?? 'Unknown',
      // A Listed row with no listed_at (legacy data, or an eBay-synced
      // listing — ebay_reconcile_inventory_row does not currently set
      // listed_at) falls back to created_at rather than being silently
      // excluded from staleness tracking entirely.
      effectiveDate: r.status === 'Listed' ? (r.listed_at ?? r.created_at) : r.created_at,
    }))
    .filter((r) => r.effectiveDate && new Date(r.effectiveDate).getTime() < cutoffMs)
    .sort((a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime())
    .slice(0, limit)
    .map((r) => ({
      sku: r.sku,
      nickname: r.nickname,
      days: Math.floor((nowMs - new Date(r.effectiveDate).getTime()) / 86400000),
    }));
}
