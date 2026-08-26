// SoldComps (api.sold-comps.com) — the approved sold-history provider while
// eBay Marketplace Insights production access is unavailable (task doc §4).
// Built behind SoldMarketDataProvider so another source (e.g. a future
// EbayMarketplaceInsightsProvider) can replace it later without touching
// the decision engine or any caller of this interface.
//
// ****************************************************************************
// CONTRACT NOT LIVE-VERIFIED. This sandbox's network egress to
// sold-comps.com is blocked, so the exact request shape below (query
// param name, base path, response envelope) could not be confirmed against
// https://sold-comps.com/docs directly. It is built from: (a) the exact
// field list the product owner specified for this task (soldPrice,
// totalPrice, shippingPrice, shippingType, endedAt, condition, conditionId,
// buyingFormat, bidCount, bestOfferAccepted, listingType, itemId, listing
// URL), and (b) third-party corroboration (Bearer `sc_...` API key, GET
// request, up to 40 results per call). Runtime validation below will
// reject anything that doesn't match this shape rather than silently
// trusting it — but a real SOLDCOMPS_API_KEY and one live test call are
// required before this can be trusted in production. See session report.
// ****************************************************************************
import type { SoldCompListing, MarketDataFailureReason } from "./marketData.ts"

export interface SoldCompsQuery {
  searchTerms: string       // normalized identification search terms
  limit?: number
}

export type SoldEvidenceResult =
  | { ok: true; comps: SoldCompListing[] }
  | { ok: false; reason: MarketDataFailureReason; detail: string }

export interface SoldMarketDataProvider {
  readonly providerId: string
  searchSoldComps(query: SoldCompsQuery): Promise<SoldEvidenceResult>
}

const REQUEST_TIMEOUT_MS = 10_000;

function soldCompsBaseUrl(): string {
  // Overridable via secret so the real path can be corrected without a
  // code change once the docs are confirmed against a real account.
  return Deno.env.get('SOLDCOMPS_API_BASE_URL') ?? 'https://api.sold-comps.com/v1/scrape';
}

// Runtime-validates one raw API record against the field contract. Returns
// null (dropped, not fabricated) for anything that fails validation —
// never coerces a missing/malformed price into a guessed number.
function parseSoldComp(raw: unknown): SoldCompListing | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const itemId = r.itemId;
  const soldPrice = r.soldPrice;
  const endedAt = r.endedAt;
  if (typeof itemId !== 'string' && typeof itemId !== 'number') return null;
  if (typeof soldPrice !== 'number' || !Number.isFinite(soldPrice) || soldPrice <= 0) return null;
  if (typeof endedAt !== 'string' || Number.isNaN(Date.parse(endedAt))) return null;

  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

  return {
    itemId: String(itemId),
    title: str(r.title) ?? '',
    soldPrice,
    totalPrice: num(r.totalPrice),
    shippingPrice: num(r.shippingPrice),
    shippingType: str(r.shippingType),
    currency: str(r.currency) ?? 'USD',
    endedAt: new Date(endedAt).toISOString(),
    condition: str(r.condition),
    conditionId: str(r.conditionId) ?? (typeof r.conditionId === 'number' ? String(r.conditionId) : null),
    buyingFormat: str(r.buyingFormat),
    bidCount: num(r.bidCount),
    bestOfferAccepted: r.bestOfferAccepted === true,
    listingType: str(r.listingType),
    listingUrl: str(r.listingUrl) ?? str(r.url) ?? str(r.link) ?? str(r.itemWebUrl),
    sellerFeedbackScore: num(r.sellerFeedbackScore),
    sellerFeedbackPercent: num(r.sellerFeedbackPercent),
  };
}

class SoldCompsProvider implements SoldMarketDataProvider {
  readonly providerId = 'sold-comps.com';
  constructor(private readonly apiKey: string) {}

  async searchSoldComps(query: SoldCompsQuery): Promise<SoldEvidenceResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const qs = new URLSearchParams({
        keywords: query.searchTerms,
        limit: String(Math.min(query.limit ?? 40, 40)),
      });
      const res = await fetch(`${soldCompsBaseUrl()}?${qs.toString()}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: controller.signal,
      });

      if (res.status === 429) {
        return { ok: false, reason: 'PROVIDER_RATE_LIMITED', detail: 'SoldComps returned 429' };
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { ok: false, reason: 'SOLDCOMPS_UNAVAILABLE', detail: `${res.status} ${body}`.slice(0, 500) };
      }

      const data = await res.json().catch(() => null);
      if (data === null) {
        return { ok: false, reason: 'MALFORMED_PROVIDER_RESPONSE', detail: 'SoldComps response was not valid JSON' };
      }

      const rawList: unknown[] = Array.isArray(data)
        ? data
        : Array.isArray((data as Record<string, unknown>)?.results)
          ? (data as Record<string, unknown>).results as unknown[]
          : Array.isArray((data as Record<string, unknown>)?.listings)
            ? (data as Record<string, unknown>).listings as unknown[]
            : [];

      const comps = rawList.map(parseSoldComp).filter((c): c is SoldCompListing => c !== null);

      if (rawList.length > 0 && comps.length === 0) {
        return { ok: false, reason: 'MALFORMED_PROVIDER_RESPONSE', detail: 'SoldComps returned records but none matched the expected field contract — verify the API contract before relying on this provider' };
      }

      return { ok: true, comps };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, reason: 'PROVIDER_TIMEOUT', detail: `SoldComps request exceeded ${REQUEST_TIMEOUT_MS}ms` };
      }
      return { ok: false, reason: 'SOLDCOMPS_UNAVAILABLE', detail: err instanceof Error ? err.message : String(err) };
    } finally {
      clearTimeout(timeout);
    }
  }
}

// Factory — returns null when SOLDCOMPS_API_KEY is not configured. Callers
// must treat null as SOLDCOMPS_NOT_CONFIGURED, never silently skip to an
// AI estimate or a fabricated value.
export function getSoldMarketDataProvider(): SoldMarketDataProvider | null {
  const apiKey = Deno.env.get('SOLDCOMPS_API_KEY');
  if (!apiKey) return null;
  return new SoldCompsProvider(apiKey);
}
