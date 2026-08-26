// eBay Catalog API — product resolution. Only used when a supported
// identifier (GTIN/ePID/model/MPN) makes a defensible product match
// possible (task doc §2). Distinguishes exact from probable matches and
// never forces a catalog match onto weak evidence — an unmatched/ambiguous
// result returns matchType: 'none', it does not fall back to a guess.
//
// LIVE-VERIFIED 2026-08-26: the existing production EBAY_CLIENT_ID/SECRET
// client-credentials token (default api_scope — same token that grants
// Browse and Taxonomy) gets HTTP 403 "Insufficient permissions to fulfill
// the request" (eBay errorId 1100) from this endpoint. Catalog access is
// not currently entitled for this app. This does not fail the pipeline —
// catalogSearchByGtin/catalogSearchByKeywords already return matchType:
// 'none' on any non-ok response, and the pipeline treats catalog match as
// best-effort/informational — but callers should not expect a working
// catalog match until this is entitled (report as PRODUCT/PLATFORM
// DECISION, not silently retried with different scopes/paths).
import { getEbayAppAccessToken, ebayApiBase, EbayAppAuthError } from "./ebayAppAuth.ts";
import type { CatalogMatch } from "./marketData.ts";

interface CatalogSearchResult {
  epid?: string
  title?: string
  gtins?: Array<{ gtin?: string }>
  aspects?: Array<{ localizedName?: string; localizedValues?: string[] }>
  brand?: string
}

function toCatalogMatch(item: CatalogSearchResult, matchType: CatalogMatch['matchType']): CatalogMatch {
  const aspects: Record<string, string[]> = {};
  for (const a of item.aspects ?? []) {
    if (a.localizedName) aspects[a.localizedName] = a.localizedValues ?? [];
  }
  return {
    matchType,
    epid: item.epid ?? null,
    gtin: item.gtins?.[0]?.gtin ?? null,
    title: item.title ?? null,
    brand: item.brand ?? null,
    aspects,
  };
}

const NONE_MATCH: CatalogMatch = { matchType: 'none', epid: null, gtin: null, title: null, brand: null, aspects: {} };

// Exact match by GTIN (barcode/UPC/EAN/ISBN) — the highest-confidence path.
export async function catalogSearchByGtin(gtin: string): Promise<CatalogMatch> {
  return catalogSearch({ gtin }, 'exact');
}

// Probable match by keyword query (e.g. verified brand + model text) — never
// treated as exact, since keyword search can return multiple candidates.
export async function catalogSearchByKeywords(query: string): Promise<CatalogMatch> {
  return catalogSearch({ q: query }, 'probable');
}

async function catalogSearch(
  params: Record<string, string>,
  matchTypeIfFound: CatalogMatch['matchType'],
): Promise<CatalogMatch> {
  try {
    const token = await getEbayAppAccessToken();
    const qs = new URLSearchParams({ ...params, limit: '5' });
    const res = await fetch(
      `${ebayApiBase()}/commerce/catalog/v1_beta/product_summary/search?${qs.toString()}`,
      { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } },
    );
    if (!res.ok) return NONE_MATCH;

    const data = await res.json() as { productSummaries?: CatalogSearchResult[]; total?: number };
    const results = data.productSummaries ?? [];
    if (results.length === 0) return NONE_MATCH;

    // A GTIN search returning exactly one result is a defensible exact
    // match; multiple results (ambiguous GTIN reuse) or any keyword search
    // is only ever probable — never force it to exact.
    const matchType = matchTypeIfFound === 'exact' && results.length === 1 ? 'exact' : 'probable';
    return toCatalogMatch(results[0], matchType);
  } catch (err) {
    if (err instanceof EbayAppAuthError) throw err;
    return NONE_MATCH;
  }
}
