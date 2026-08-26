// eBay Taxonomy API — category resolution. Verified category IDs only;
// never treats an AI-generated category string as authoritative when a
// verified category can be resolved (task doc §2).
//
// LIVE-VERIFIED 2026-08-26: get_default_category_tree_id returns 200 with
// {categoryTreeId, categoryTreeVersion} using the production client-
// credentials token — matches getDefaultCategoryTreeId below. The
// downstream get_category_suggestions call was not separately exercised
// live (its prerequisite, the tree-id lookup, was) — same default-scope
// token, no separate entitlement expected, but treat as unconfirmed if
// precision matters.
import { getEbayAppAccessToken, ebayApiBase, EbayAppAuthError } from "./ebayAppAuth.ts";
import type { CategoryResolution } from "./marketData.ts";

const MARKETPLACE_ID = 'EBAY_US';

let cachedDefaultTreeId: string | null = null;

async function getDefaultCategoryTreeId(): Promise<string | null> {
  if (cachedDefaultTreeId) return cachedDefaultTreeId;
  const token = await getEbayAppAccessToken();
  const res = await fetch(
    `${ebayApiBase()}/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${MARKETPLACE_ID}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const data = await res.json() as { categoryTreeId?: string };
  cachedDefaultTreeId = data.categoryTreeId ?? null;
  return cachedDefaultTreeId;
}

// Resolves a free-text query (e.g. the identification layer's normalized
// search terms) to a verified eBay category. Returns resolved: false rather
// than fabricating a category when Taxonomy can't find a confident match.
export async function resolveCategory(query: string): Promise<CategoryResolution> {
  try {
    const treeId = await getDefaultCategoryTreeId();
    if (!treeId) {
      return { categoryTreeId: null, categoryId: null, categoryName: null, resolved: false };
    }

    const token = await getEbayAppAccessToken();
    const res = await fetch(
      `${ebayApiBase()}/commerce/taxonomy/v1/category_tree/${treeId}/get_category_suggestions?q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      return { categoryTreeId: treeId, categoryId: null, categoryName: null, resolved: false };
    }

    const data = await res.json() as {
      categorySuggestions?: Array<{ category?: { categoryId?: string; categoryName?: string } }>
    };
    const top = data.categorySuggestions?.[0]?.category;
    if (!top?.categoryId) {
      return { categoryTreeId: treeId, categoryId: null, categoryName: null, resolved: false };
    }

    return {
      categoryTreeId: treeId,
      categoryId: top.categoryId,
      categoryName: top.categoryName ?? null,
      resolved: true,
    };
  } catch (err) {
    if (err instanceof EbayAppAuthError) throw err;
    // Malformed/unavailable response — never fabricate a category.
    return { categoryTreeId: null, categoryId: null, categoryName: null, resolved: false };
  }
}
