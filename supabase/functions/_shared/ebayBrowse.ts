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
import { externalCall } from "./externalCall.ts";
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

// A `null` return means the active-market count is UNKNOWN (Browse call
// failed, timed out, rate-limited, or returned a malformed body) — it must
// never be treated as a verified zero. Only a body that actually parsed
// (even with itemSummaries/total legitimately absent/0) produces a real
// ActiveMarketEvidence with matchingActiveCount: 0. Conflating the two was
// the P0 defect that let a failed Browse lookup masquerade as "zero
// competition", inflating STR to 100% and turnover to 0 days downstream in
// marketDataPipeline.ts/marketMetrics.ts.
export async function searchActiveListings(params: BrowseSearchParams): Promise<ActiveMarketEvidence | null> {
  try {
    const token = await getEbayAppAccessToken();
    const qs = new URLSearchParams({ q: params.query, limit: String(params.limit ?? 20) });
    if (params.categoryId) qs.set('category_ids', params.categoryId);

    const filters: string[] = [];
    if (params.conditionIds?.length) filters.push(`conditionIds:{${params.conditionIds.join('|')}}`);
    if (filters.length) qs.set('filter', filters.join(','));

    // GET is inherently safe to retry — bounded transient retry via P2-18.
    const data = await externalCall<{ itemSummaries?: BrowseItemSummary[]; total?: number }>(
      `${ebayApiBase()}/buy/browse/v1/item_summary/search?${qs.toString()}`,
      { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } },
      { timeoutMs: 10_000, maxRetries: 2 },
      (r) => r.json() as Promise<{ itemSummaries?: BrowseItemSummary[]; total?: number }>,
    ).catch(() => null);
    // externalCall failed (HTTP error / timeout / rate limit after retries) or
    // the body wasn't valid JSON — active count is unknown, not zero.
    if (!data) return null;
    const items = data.itemSummaries ?? [];
    if (!Array.isArray(items)) return null; // malformed provider response

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
    return null; // unexpected failure — unknown, never a fabricated zero
  }
}
