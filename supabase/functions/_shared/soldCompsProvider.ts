// SoldComps (api.sold-comps.com) — the approved sold-history provider while
// eBay Marketplace Insights production access is unavailable (task doc §4).
// Built behind SoldMarketDataProvider so another source (e.g. a future
// EbayMarketplaceInsightsProvider) can replace it later without touching
// the decision engine or any caller of this interface.
//
// ****************************************************************************
// CONTRACT LIVE-VERIFIED 2026-08-26 via a temporary diagnostic edge function
// invoked through pg_net (this sandbox's own egress to sold-comps.com is
// blocked, but Supabase's runtime is not — see session report). Confirmed
// against a real GET /v1/scrape?keyword=...&limit=... call with the live
// SOLD_COMPS_API_KEY secret:
//   - query param is `keyword` (singular), not `keywords`
//   - response envelope: {keyword, page, totalItems, totalResults,
//     hasNextPage, autoSelectedCategory, items: [...]}
//   - soldPrice/totalPrice/shippingPrice arrive as NUMERIC STRINGS ("81",
//     "95.95"), not numbers — coerced below, never left as unparsed strings
//   - conditionId arrives as a number (e.g. 1000, 3000)
//   - endedAt arrives as a date-only string ("2026-08-26"), not a full
//     ISO 8601 datetime — still Date.parse-able
//   - listing URL field is `url`, not `listingUrl`
//   - seller positive-feedback field is `sellerPositivePercent`, not
//     `sellerFeedbackPercent`
//   - per-format currency fields are `soldCurrency`/`shippingCurrency`,
//     no single top-level `currency`
//   - auth confirmed via 200 + x-ratelimit-remaining/-limit headers (59/60
//     on first call) — a malformed request returns 400 with a Zod error
//     body, not 401, so a missing/invalid `keyword` looks like a validation
//     error, not an auth failure
//   - pagination confirmed present (`page`, `hasNextPage`) but not wired
//     into this provider — single page of up to 40 results per call, same
//     as originally documented; multi-page fetch is a P1 enhancement
// Not verified live: Best Offer semantics beyond the `bestOfferAccepted`
// boolean field being present and populated (true on the sampled records);
// exact 90-day window enforcement (no explicit date-range request param
// was found/needed — treated as the provider's documented retention, per
// DEFAULT_SOLD_WINDOW_DAYS in marketDataPipeline.ts, not a request param).
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

// Accepts a real number OR a numeric string (SoldComps sends soldPrice/
// totalPrice/shippingPrice as strings, e.g. "81", "95.95") — never coerces
// a non-numeric or empty value, that stays null rather than becoming 0.
function numLike(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Runtime-validates one raw API record against the live-verified field
// contract (see file header). Returns null (dropped, not fabricated) for
// anything that fails validation — never coerces a missing/malformed price
// into a guessed number. Exported for direct unit testing.
export function parseSoldComp(raw: unknown): SoldCompListing | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const itemId = r.itemId;
  const soldPrice = numLike(r.soldPrice);
  const endedAt = r.endedAt;
  if (typeof itemId !== 'string' && typeof itemId !== 'number') return null;
  if (soldPrice === null || soldPrice <= 0) return null;
  if (typeof endedAt !== 'string' || Number.isNaN(Date.parse(endedAt))) return null;

  const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

  return {
    itemId: String(itemId),
    title: str(r.title) ?? '',
    soldPrice,
    totalPrice: numLike(r.totalPrice),
    shippingPrice: numLike(r.shippingPrice),
    shippingType: str(r.shippingType),
    currency: str(r.soldCurrency) ?? str(r.currency) ?? 'USD',
    endedAt: new Date(endedAt).toISOString(),
    condition: str(r.condition),
    conditionId: str(r.conditionId) ?? (typeof r.conditionId === 'number' ? String(r.conditionId) : null),
    buyingFormat: str(r.buyingFormat),
    bidCount: numLike(r.bidCount),
    bestOfferAccepted: r.bestOfferAccepted === true,
    listingType: str(r.listingType),
    listingUrl: str(r.url) ?? str(r.listingUrl) ?? str(r.link) ?? str(r.itemWebUrl),
    sellerFeedbackScore: numLike(r.sellerFeedbackScore),
    sellerFeedbackPercent: numLike(r.sellerPositivePercent) ?? numLike(r.sellerFeedbackPercent),
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
        keyword: query.searchTerms,
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

      const d = data as Record<string, unknown>;
      // `items` is the live-verified envelope key (see file header).
      // `results`/`listings` kept as defensive fallbacks only.
      const rawList: unknown[] = Array.isArray(data)
        ? data
        : Array.isArray(d?.items) ? d.items as unknown[]
        : Array.isArray(d?.results) ? d.results as unknown[]
        : Array.isArray(d?.listings) ? d.listings as unknown[]
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

// Confirmed 2026-08-26 (product owner): the Supabase secret is set under
// this exact name. The prior 3-name fallback is retired now that the name
// is confirmed — do not reintroduce alternate aliases.
const SOLDCOMPS_API_KEY_ENV_NAME = 'SOLD_COMPS_API_KEY';

// Factory — returns null when not configured. Callers must treat null as
// SOLDCOMPS_NOT_CONFIGURED, never silently skip to an AI estimate or a
// fabricated value.
export function getSoldMarketDataProvider(): SoldMarketDataProvider | null {
  const apiKey = Deno.env.get(SOLDCOMPS_API_KEY_ENV_NAME);
  return apiKey ? new SoldCompsProvider(apiKey) : null;
}
