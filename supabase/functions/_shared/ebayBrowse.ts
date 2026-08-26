// eBay Browse API — the authoritative source for active-market/current-
// competition evidence (task doc §3). Never represents active asking
// prices as sold prices; kept structurally distinct (ActiveMarketEvidence)
// from SoldComps sold evidence.
//
// LIVE-VERIFIED 2026-08-26: item_summary/search with the production
// client-credentials token returns 200 with itemSummaries[].{itemId,
// title, price:{value,currency}, condition, conditionId, itemWebUrl, ...}
// — matches the parsing below exactly, no changes needed.
import { getEbayAppAccessToken, ebayApiBase, EbayAppAuthError } from "./ebayAppAuth.ts";
import type { ActiveMarketEvidence, ActiveListingSummary } from "./marketData.ts";

interface BrowseItemSummary {
  itemId?: string
  title?: string
  price?: { value?: string; currency?: string }
  condition?: string
  conditionId?: string
  categoryId?: string
  itemWebUrl?: string
}

export interface BrowseSearchParams {
  query: string
  categoryId?: string | null
  conditionIds?: string[] // eBay condition IDs, e.g. ['3000'] for Used
  limit?: number
}

const EMPTY_EVIDENCE: ActiveMarketEvidence = {
  matchingActiveCount: 0, sampledListings: [], askingPriceLow: null, askingPriceHigh: null,
};

export async function searchActiveListings(params: BrowseSearchParams): Promise<ActiveMarketEvidence> {
  try {
    const token = await getEbayAppAccessToken();
    const qs = new URLSearchParams({ q: params.query, limit: String(params.limit ?? 20) });
    if (params.categoryId) qs.set('category_ids', params.categoryId);

    const filters: string[] = [];
    if (params.conditionIds?.length) filters.push(`conditionIds:{${params.conditionIds.join('|')}}`);
    if (filters.length) qs.set('filter', filters.join(','));

    const res = await fetch(
      `${ebayApiBase()}/buy/browse/v1/item_summary/search?${qs.toString()}`,
      { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } },
    );
    if (!res.ok) return EMPTY_EVIDENCE;

    const data = await res.json() as { itemSummaries?: BrowseItemSummary[]; total?: number };
    const items = data.itemSummaries ?? [];

    const sampledListings: ActiveListingSummary[] = items
      .filter(i => i.itemId && i.price?.value)
      .map(i => ({
        itemId: i.itemId!,
        title: i.title ?? '',
        price: Number(i.price!.value),
        currency: i.price!.currency ?? 'USD',
        condition: i.condition ?? null,
        conditionId: i.conditionId ?? null,
        categoryId: i.categoryId ?? null,
        itemWebUrl: i.itemWebUrl ?? null,
      }))
      .filter(l => Number.isFinite(l.price) && l.price > 0);

    const prices = sampledListings.map(l => l.price).sort((a, b) => a - b);

    return {
      matchingActiveCount: data.total ?? sampledListings.length,
      sampledListings,
      askingPriceLow: prices.length ? prices[0] : null,
      askingPriceHigh: prices.length ? prices[prices.length - 1] : null,
    };
  } catch (err) {
    if (err instanceof EbayAppAuthError) throw err;
    return EMPTY_EVIDENCE;
  }
}
