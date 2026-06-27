import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJWT } from "../_shared/jwt.ts";
import { SCAN_LIMITS, ITEM_LIMITS } from "../_shared/tierLimits.ts";

const CATEGORY_SKU_PREFIX: Record<string, string> = {
  'Consumer Electronics':            'ELEC',
  'Clothing, Shoes & Accessories':   'CLTH',
  'Home & Garden':                   'HOME',
  'Toys & Hobbies':                  'TOYS',
  'Sporting Goods':                  'SPRT',
  'Books':                           'BOOK',
  'Music':                           'MUSC',
  'Movies & TV':                     'MOVI',
  'Video Games & Consoles':          'GAME',
  'Jewelry & Watches':               'JEWL',
  'Collectibles':                    'COLL',
  'Art':                             'ART_',
  'Baby':                            'BABY',
  'Cameras & Photography':           'CAMR',
  'Musical Instruments & Gear':      'INST',
  'Business & Industrial':           'BIZZ',
  'eBay Motors':                     'AUTO',
  'Antiques':                        'ANTQ',
  'Computers, Tablets & Networking': 'COMP',
  'Cell Phones & Accessories':       'CELL',
  'Entertainment Memorabilia':       'ENT_',
};

class HttpError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly data: Record<string, unknown> = {},
  ) { super(message); }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Defaults from FEATURE_TRIAGE.md — used only when user has no settings row
const DEFAULT_SETTINGS = {
  ebay_fee: 13, pkg_cost: 1.25, target_roi: 200, min_profit: 15,
  sourcing_style: 'balanced', ship_cost: 6.00, shipping: 'buyer',
};

type Settings = typeof DEFAULT_SETTINGS;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Look up or lazily create the users row by email.
// Bridges Supabase Auth (UUID sub) → custom users table (integer id).
async function getOrCreateUser(
  supabase: ReturnType<typeof createClient>,
  email: string,
  username: string,
): Promise<{ id: number; tier: string; scan_count_month: number; scan_reset_date: string; token_version: number; settings: Settings; }> {
  const { data: existing } = await supabase
    .from('users').select('id, tier, scan_count_month, scan_reset_date, token_version')
    .eq('email', email).maybeSingle();

  let user = existing;
  if (!user) {
    const { data: created, error } = await supabase
      .from('users')
      .insert({ email, username: username || email.split('@')[0], password: 'supabase_auth', is_verified: true })
      .select('id, tier, scan_count_month, scan_reset_date, token_version').single();
    if (error || !created) throw new Error('Failed to create user');
    user = created;
  }

  const { data: settingsRow } = await supabase
    .from('settings').select('*').eq('user_id', user.id).maybeSingle();

  return { ...user, settings: settingsRow ?? DEFAULT_SETTINGS };
}

function calcProfit(sell: number, cost: number, pkg: number, ship: number, fee: number) {
  const ebayFees = sell * (fee / 100);
  const totalFees = ebayFees + pkg + ship;
  const net = sell - totalFees - cost;
  const roi = cost > 0 ? (net / cost) * 100 : 0;
  return { net: r2(net), roi: r2(roi) };
}
function r2(n: number) { return Math.round(n * 100) / 100; }

// SEC-017: strip control chars and truncate before injecting user text into AI prompts
function sanitizeForPrompt(s: string, maxLen = 500): string {
  return s.replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, maxLen).trim();
}

function getDecision(roi: number, confidence: number, s: Settings, net?: number, demandLevel?: string): 'LIST' | 'HOT' | 'SKIP' {
  const mod = s.sourcing_style === 'conservative' ? 1.2 : s.sourcing_style === 'aggressive' ? 0.8 : 1.0;
  const target = s.target_roi * mod;
  const minProfit = s.min_profit * mod;
  if (net !== undefined && net < minProfit) return 'SKIP';
  if (roi <= 0) return 'SKIP';
  const isHot = demandLevel === 'HIGH' || demandLevel === 'VERY HIGH'
    || (net !== undefined && net >= minProfit * 2)
    || roi >= s.target_roi * 2;
  if (isHot && confidence >= 70) return 'HOT';
  if (roi > target && confidence >= 50) return 'LIST';
  return 'SKIP';
}

function detectImageMime(buf: ArrayBuffer): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const b = new Uint8Array(buf, 0, 12);
  if (b[0] === 0xFF && b[1] === 0xD8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[4] === 0x57 && b[5] === 0x45 && b[6] === 0x42 && b[7] === 0x50) return 'image/webp';
  return 'image/jpeg'; // fallback
}

async function callAnthropic(
  key: string, system: string, images: string[], maxTokens = 1024,
  mimeTypes: ('image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')[] = [],
): Promise<string> {
  const imageBlocks = images.map((data, i) => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: (mimeTypes[i] ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data },
  }));
  const textPrompt = images.length > 1
    ? `Analyze these ${images.length} photos of the same item from different angles.`
    : 'Analyze this image.';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{
        role: 'user',
        content: [...imageBlocks, { type: 'text', text: textPrompt }],
      }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? 'Anthropic error');
  const raw = data.content[0].text as string;
  // Strip markdown code fences Claude sometimes adds despite "no markdown" instructions
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

// Verbatim from FEATURE_TRIAGE.md P-03 (getSingleSys L4644–4663)
function buildSinglePrompt(s: Settings): string {
  return `You are a meticulous eBay sourcing expert with deep product knowledge. Your job is to ACCURATELY identify items and provide REALISTIC eBay sold market data — not retail prices.

IDENTIFICATION (critical):
- Study EVERY visible detail in the photo: brand logos, model numbers on labels/tags, serial plates, color, size, design era, materials, distinctive features.
- Identify the EXACT make, model, and variant — not just a generic category. "Camera" is wrong. "Minolta X-700 35mm SLR Film Camera" is right.
- Use any text description to confirm or narrow your photo identification.
- If you cannot identify specifics, say so clearly in confidence_reason and set confidence below 60.

PRICING (critical):
- avg_sold_price = median of recent actual eBay SOLD listings, not asking price or retail.
- price_low/price_high = realistic 20th-80th percentile of actual sold comps.
- sell_through_rate = % of listings that actually sell (0-100), not just views.
- avg_days_to_sell = realistic median days from listing to sale for this specific item.

This seller's fee structure: ${s.ebay_fee}% eBay fee + $${s.pkg_cost} packaging. Buyer always pays shipping.
Minimum profitable sale for this seller: their cost + fees + $${s.min_profit} profit.

Return ONLY valid JSON, no markdown:
{"item_name":"specific make model and variant","category":"string","brand":"string or null","model_number":"string or null","estimated_weight_lbs":number,"avg_sold_price":number,"price_low":number,"price_high":number,"sell_through_rate":number,"avg_days_to_sell":number,"demand_level":"LOW|MEDIUM|HIGH|VERY HIGH","confidence":number,"confidence_reason":"what you confirmed and what you could not","condition_notes":"visible condition issues","search_keywords":["4 specific eBay search terms for this exact item"],"listing_tips":["4 actionable selling tips"],"risk_flags":["red flags or empty array"],"notes":"important context about market or item"}`;
}

// Verbatim from FEATURE_TRIAGE.md P-04 (getShelfSys L4718–4731)
function buildShelfPrompt(s: Settings): string {
  return `You are a meticulous eBay sourcing expert scanning a shelf photo. Study EVERY item with care.

For each distinct item visible:
- Identify as specifically as possible: brand, model, type, era. Do not be generic.
- Use all visible clues: labels, logos, colors, shapes, text, design era.
- Provide REALISTIC eBay sold prices — actual sold comps, not retail or asking prices.
- Only include items you can identify with at least 40% confidence.
- Calculate estimated_profit as: avg_sold_price - estimated_cost_at_thrift - (avg_sold_price * ${s.ebay_fee}/100) - ${s.pkg_cost}
- Buyer always pays shipping. Min profit threshold for FLIP: $${s.min_profit}. Target ROI for HOT: ${s.target_roi}%.

Return ONLY a valid JSON array, no markdown:
[{"item_name":"specific name with brand and model","category":"string","brand":"string or null","avg_sold_price":number,"estimated_cost_at_thrift":number,"sell_through_rate":number,"avg_days_to_sell":number,"demand_level":"LOW|MEDIUM|HIGH|VERY HIGH","decision":"LIST|HOT|SKIP","decision_reason":"one specific sentence with reasoning","estimated_profit":number,"confidence":number,"condition_notes":"string"}]
Sort: HOT first, then LIST, then SKIP.`;
}

async function handleSingleScan(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  userId: number,
  settings: Settings,
  images: string[],
  mimeTypes: string[] = [],
) {
  const raw = await callAnthropic(anthropicKey, buildSinglePrompt(settings), images, undefined, mimeTypes as ('image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')[]);
  let ai: Record<string, unknown>;
  try {
    ai = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try { ai = JSON.parse(m[0]); }
      catch { throw new Error('Could not analyze this photo. Try a clearer photo of a single item.'); }
    } else {
      throw new Error('Could not analyze this photo. Try a clearer photo of a single item.');
    }
  }

  const avgSell = (ai.avg_sold_price as number) ?? 0;
  const estimatedCost = r2(avgSell * 0.10); // ~typical thrift store cost for display
  // Only charge shipping when seller pays ('free' shipping offer). When buyer
  // pays ('buyer'), ship_cost is not a seller expense — always was $0.
  const shipForCalc = settings.shipping === 'free' ? settings.ship_cost : 0;
  const { net, roi } = calcProfit(avgSell, estimatedCost, settings.pkg_cost, shipForCalc, settings.ebay_fee);
  const confidence = (ai.confidence as number) ?? 50;
  const decision = getDecision(roi, confidence, settings, net, ai.demand_level as string | undefined);

  const { data: logRow } = await supabase.from('scan_log').insert({
    user_id: userId, scan_type: 'single', decision,
    item_name: ai.item_name, category: ai.category,
    estimated_profit: net, estimated_sell: avgSell,
    roi, confidence, bought: false, raw_response: ai,
  }).select('id').single();

  return {
    decision, itemName: ai.item_name, estimatedProfit: net,
    estimatedSell: avgSell, estimatedCost, confidence, roi,
    reasoning: (ai.confidence_reason as string) ?? (ai.notes as string) ?? '',
    category: ai.category, brand: (ai.brand as string) ?? null,
    searchKeywords: ai.search_keywords ?? [],
    priceLow: ai.price_low, priceHigh: ai.price_high,
    sellThroughRate: r2((ai.sell_through_rate as number) ?? 0),
    avgDaysToSell: ai.avg_days_to_sell, demandLevel: ai.demand_level,
    listingTips: ai.listing_tips ?? [], riskFlags: ai.risk_flags ?? [],
    conditionNotes: ai.condition_notes ?? '',
    notes: (ai.notes as string) ?? '',
    scanLogId: logRow?.id ?? null,
  };
}

async function handleShelfScan(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  userId: number,
  settings: Settings,
  images: string[],
  mimeTypes: string[] = [],
) {
  const raw = await callAnthropic(anthropicKey, buildShelfPrompt(settings), images, 2048, mimeTypes as ('image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')[]);
  let aiItems: Record<string, unknown>[];
  try { aiItems = JSON.parse(raw); }
  catch { throw new Error('AI returned invalid JSON'); }
  if (!Array.isArray(aiItems)) throw new Error('AI returned non-array for shelf scan');

  const shipForCalc = settings.shipping === 'free' ? settings.ship_cost : 0;
  const items = aiItems.map((ai) => {
    const sell = (ai.avg_sold_price as number) ?? 0;
    const cost = (ai.estimated_cost_at_thrift as number) ?? r2(sell * 0.10);
    const { net, roi } = calcProfit(sell, cost, settings.pkg_cost, shipForCalc, settings.ebay_fee);
    const confidence = (ai.confidence as number) ?? 50;
    const decision = getDecision(roi, confidence, settings, net, ai.demand_level as string | undefined);
    return {
      decision, itemName: ai.item_name, estimatedProfit: net,
      avgSoldPrice: sell, estimatedCost: cost, roi, confidence,
      decisionReason: ai.decision_reason ?? '', category: ai.category,
      conditionNotes: ai.condition_notes ?? '', demandLevel: ai.demand_level,
    };
  });

  await supabase.from('scan_log').insert({
    user_id: userId, scan_type: 'shelf', decision: null,
    bought: false, raw_response: aiItems,
  });

  return { items };
}

async function handleBuyItem(
  supabase: ReturnType<typeof createClient>,
  userId: number,
  tier: string,
  body: Record<string, unknown>,
) {
  const limit = ITEM_LIMITS[tier] ?? null;
  if (limit !== null) {
    const { count } = await supabase
      .from('inventory').select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if ((count ?? 0) >= limit) {
      throw new HttpError('item_limit_reached', 429, { tier, limit });
    }
  }

  const { data: inv, error } = await supabase.from('inventory').insert({
    user_id: userId,
    item_id: `scan-${Date.now()}`,
    nickname: body.itemName,
    category: body.category ?? null,
    cost: body.cost,
    sell_price: body.sellPrice ?? null,
    status: 'Unlisted',
    platform: 'eBay',
    created_from: 'scan',
    sourcing_meta: body.sourcingMeta ?? null,
    photos: '[]',
  }).select('id').single();

  if (error) throw new Error(error.message);

  if (body.scanLogId) {
    await supabase.from('scan_log')
      .update({ bought: true, cost: body.cost })
      .eq('id', body.scanLogId).eq('user_id', userId);
  }

  return { inventoryId: inv.id };
}

// ── Inventory handlers ──────────────────────────────────────────────────────

async function handleInventoryList(
  supabase: ReturnType<typeof createClient>,
  userId: number,
  settings: Settings,
  tier: string,
  pageSize = 500,
  pageOffset = 0,
) {
  // §5.8: paginated — default page 500 prevents full-table scans for Stack/Empire users
  const { data: items, error } = await supabase
    .from('inventory').select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(pageOffset, pageOffset + pageSize - 1);
  if (error) throw new Error(error.message);

  const { count } = await supabase
    .from('inventory').select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return { items: items ?? [], itemCount: count ?? 0, settings, tier, pageSize, pageOffset };
}

async function handleInventoryCreate(
  supabase: ReturnType<typeof createClient>,
  userId: number,
  tier: string,
  body: Record<string, unknown>,
) {
  // Tier gate — check BEFORE writing
  const limit = ITEM_LIMITS[tier] ?? null;
  if (limit !== null) {
    const { count } = await supabase
      .from('inventory').select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if ((count ?? 0) >= limit) {
      throw new HttpError('item_limit_reached', 429, { tier, limit });
    }
  }

  // SKU generation: category prefix + zero-padded count across all user items
  const category = (body.category as string) ?? 'Other';
  const prefix = CATEGORY_SKU_PREFIX[category] ?? 'OTH_';
  const { count: existingCount } = await supabase
    .from('inventory').select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  const sku = `${prefix}-${String((existingCount ?? 0) + 1).padStart(5, '0')}`;

  const photos = body.photos ?? [];
  const { data: item, error } = await supabase.from('inventory').insert({
    user_id:      userId,
    item_id:      `manual-${Date.now()}`,
    sku,
    nickname:     body.nickname ?? null,
    category:     body.category ?? null,
    condition:    body.condition ?? null,
    cost:         body.cost ?? null,
    sell_price:   body.sellPrice ?? null,
    status:       'Unlisted',
    platform:     body.platform ?? 'eBay',
    notes:        body.notes ?? null,
    photos,
    created_from: body.createdFrom ?? 'manual',
    photo_count:  Array.isArray(photos) ? photos.length : 0,
  }).select('*').single();

  if (error) throw new Error(error.message);
  return { item };
}

async function handleInventoryUpdate(
  supabase: ReturnType<typeof createClient>,
  userId: number,
  body: Record<string, unknown>,
) {
  const itemId = body.id as number;
  if (!itemId) throw new Error('Missing item id');

  const updates: Record<string, unknown> = {};
  if (body.nickname  !== undefined) updates.nickname   = body.nickname;
  if (body.category  !== undefined) updates.category   = body.category;
  if (body.condition !== undefined) updates.condition  = body.condition;
  if (body.cost      !== undefined) updates.cost       = body.cost;
  if (body.sellPrice !== undefined) updates.sell_price = body.sellPrice;
  if (body.platform  !== undefined) updates.platform   = body.platform;
  if (body.notes     !== undefined) updates.notes      = body.notes;
  if (body.photos    !== undefined) {
    updates.photos      = body.photos;
    updates.photo_count = Array.isArray(body.photos) ? body.photos.length : 0;
  }

  const { data: item, error } = await supabase.from('inventory')
    .update(updates).eq('id', itemId).eq('user_id', userId)
    .select('*').single();
  if (error) throw new Error(error.message);
  return { item };
}

async function handleInventoryDelete(
  supabase: ReturnType<typeof createClient>,
  userId: number,
  body: Record<string, unknown>,
) {
  const itemId = body.id as number;
  if (!itemId) throw new Error('Missing item id');

  const { error } = await supabase.from('inventory')
    .delete().eq('id', itemId).eq('user_id', userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  'Unlisted':        ['Listed', 'Sold'],
  'Listed':          ['Sold', 'Unlisted'],
  'Sold':            [],
  'Ready to Export': ['Listed'],
};

async function handleInventoryStatus(
  supabase: ReturnType<typeof createClient>,
  userId: number,
  body: Record<string, unknown>,
) {
  const itemId    = body.id as number;
  const newStatus = body.status as string;
  if (!itemId || !newStatus) throw new Error('Missing id or status');

  const { data: current, error: fetchErr } = await supabase.from('inventory')
    .select('status').eq('id', itemId).eq('user_id', userId).single();
  if (fetchErr || !current) throw new Error('Item not found');

  const allowed = VALID_TRANSITIONS[current.status as string] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from ${current.status} to ${newStatus}`);
  }

  const updates: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'Listed') updates.listed_at = new Date().toISOString();
  if (newStatus === 'Sold') {
    updates.sold_at = new Date().toISOString();
    if (body.actualSellPrice != null) {
      updates.sell_price = body.actualSellPrice;
      updates.sold_price = body.actualSellPrice;
    }
  }

  const { data: item, error } = await supabase.from('inventory')
    .update(updates).eq('id', itemId).eq('user_id', userId)
    .select('*').single();
  if (error) throw new Error(error.message);
  return { item };
}

// ── categoryHint map — verbatim from FEATURE_TRIAGE F-29 L3623-3635 ───────────
const CATEGORY_HINT: Record<string, string> = {
  'Consumer Electronics':          'functional, tested, specifications',
  'Clothing, Shoes & Accessories': 'fabric, fit, brand, styling',
  'Home & Garden':                 'materials, dimensions, functionality',
  'Collectibles':                  'authenticity, rarity, condition',
  'Toys & Hobbies':                'completeness, vintage value, condition',
  'Books':                         'author, edition, binding, condition',
  'Sporting Goods':                'brand, specifications, condition',
  'Jewelry & Watches':             'material, brand, specifications',
};

async function handleListingGenerate(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  userId: number,
  settings: Settings,
  body: Record<string, unknown>,
) {
  const nickname  = sanitizeForPrompt((body.nickname  as string) ?? 'Unknown item', 200);
  const category  = (body.category  as string) ?? 'Other';
  const condition = (body.condition as string) ?? 'Used';
  const notes     = sanitizeForPrompt((body.notes as string) ?? '', 500);
  const sellPrice = body.sellPrice  != null ? Number(body.sellPrice) : null;
  const itemId    = body.itemId     as number | null ?? null;

  const categoryHint = CATEGORY_HINT[category] ?? 'key details, condition, brand';

  // Verbatim from FEATURE_TRIAGE.md F-29 P-06 (L3637–3656)
  const prompt = `You are an expert eBay reseller writing product listings. Generate a title, description, and condition note for this item.

Item name: ${nickname}
Category: ${category}
Condition: ${condition}
Seller notes: ${notes || 'No additional notes'}

Focus on: ${categoryHint}

STRICT REQUIREMENTS:
- Title: max 80 characters, eBay-optimized keywords first
- Description: 250-400 words, bullet points for key details, mobile-friendly
- Condition Note: 50-100 words, specific about condition

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "title": "...",
  "description": "...",
  "conditionNote": "...",
  "suggestedPrice": ${sellPrice ?? 'null'},
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "shippingNote": "Buyer pays shipping"
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? 'Anthropic error');

  let ai: Record<string, unknown>;
  try { ai = JSON.parse(data.content[0].text as string); }
  catch { throw new Error('AI returned invalid JSON'); }

  // Enforce title ≤80 chars
  const title = String(ai.title ?? '').slice(0, 80);

  const listing = {
    itemId,
    title,
    description:   String(ai.description   ?? ''),
    conditionNote: String(ai.conditionNote  ?? ''),
    suggestedPrice: ai.suggestedPrice != null ? Number(ai.suggestedPrice) : sellPrice,
    keywords:       Array.isArray(ai.keywords) ? ai.keywords as string[] : [],
    ebayCategory:   category,
    shippingNote:   String(ai.shippingNote ?? (settings.shipping === 'buyer' ? 'Buyer pays shipping' : 'Seller pays shipping')),
    generatedAt:    new Date().toISOString(),
  };

  // Save to inventory row if itemId provided
  if (itemId) {
    await supabase.from('inventory').update({
      listing_title:       title,
      listing_description: listing.description,
      listing_condition:   listing.conditionNote,
      listing_data:        listing,
    }).eq('id', itemId).eq('user_id', userId);
  }

  return { listing };
}

async function handleKeywordsGet(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  userId: number,
) {
  // Check growth_cache for fresh trending keywords (<24hrs)
  const { data: cacheRow } = await supabase.from('growth_cache')
    .select('cache_data, generated_at')
    .eq('user_id', userId)
    .maybeSingle();

  const cacheData = cacheRow?.cache_data as Record<string, unknown> | null;
  const cachedKw = cacheData?.trending_keywords as Record<string, unknown> | null;
  const cachedAt = cachedKw?.cached_at as string | null;

  if (cachedAt) {
    const ageHours = (Date.now() - new Date(cachedAt).getTime()) / (1000 * 3600);
    if (ageHours < 24) {
      return { ...cachedKw, fromCache: true };
    }
  }

  if (!anthropicKey) {
    return { keywords: STATIC_KEYWORDS, trending_categories: STATIC_CATEGORIES, hot_tip: STATIC_TIP, fromCache: false };
  }

  // Verbatim from FEATURE_TRIAGE.md F-28 P-08 (L5402)
  const prompt = `Search for the top trending eBay search keywords and most popular resale categories RIGHT NOW today ${new Date().toLocaleDateString()}. What are buyers searching for most on eBay this week? Focus on thrift resale categories: electronics, clothing, collectibles, home goods. Return ONLY valid JSON: {"keywords":[{"rank":1,"word":"string","trend":"up/stable/down","bar":85},...],"trending_categories":["string"],"hot_tip":"one sentence actionable tip for resellers today"}. Include exactly 10 keywords sorted by search volume.`;

  let kwResult: Record<string, unknown>;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 800,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error?.message ?? 'Anthropic error');
    const textBlock = (d.content as Array<{type: string; text?: string}>).find(b => b.type === 'text');
    kwResult = JSON.parse(textBlock?.text ?? '{}');
  } catch {
    return { keywords: STATIC_KEYWORDS, trending_categories: STATIC_CATEGORIES, hot_tip: STATIC_TIP, fromCache: false };
  }

  // Cache result
  const toCache = { ...kwResult, cached_at: new Date().toISOString() };
  const newCacheData = { ...(cacheData ?? {}), trending_keywords: toCache };
  await supabase.from('growth_cache').upsert({
    user_id: userId, cache_data: newCacheData,
    generated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  }, { onConflict: 'user_id' });

  return { ...kwResult, fromCache: false };
}

// ── Growth Agent handler ────────────────────────────────────────────────────

// ── Stats / P&L handlers ────────────────────────────────────────────────────

function calcPnlServer(
  soldItems: Record<string, unknown>[],
  allItems: Record<string, unknown>[],
  expenses: Record<string, unknown>[],
  settings: Settings & { tax_reserve_pct?: number; mileage_rate?: number; stale_days?: number },
  periodLabel: string,
) {
  const ebayFee      = settings.ebay_fee    ?? 13;
  const pkgCost      = settings.pkg_cost    ?? 1.25;
  const shipping     = settings.shipping    ?? 'buyer';
  const shipCost     = settings.ship_cost   ?? 6.00;
  const taxReservePct = settings.tax_reserve_pct ?? 0.25; // never hardcoded
  const mileageRate  = settings.mileage_rate ?? 0.72;     // never hardcoded

  let totalRevenue = 0, totalCogs = 0, totalFees = 0, totalPackaging = 0, totalShipping = 0;
  for (const item of soldItems) {
    const sell = Number(item.sell_price ?? 0);
    const cost = Number(item.cost ?? 0);
    totalRevenue   += sell;
    totalCogs      += cost;
    totalFees      += sell * (ebayFee / 100);
    totalPackaging += pkgCost;
    if (shipping === 'seller') totalShipping += shipCost;
  }

  let totalExpenses = 0, totalMiles = 0;
  for (const exp of expenses) {
    if (exp.category === 'mileage' && exp.miles != null) {
      totalMiles += Number(exp.miles);
    } else {
      totalExpenses += Number(exp.amount ?? 0);
    }
  }
  const totalMileage = totalMiles * mileageRate;
  const netProfit    = r2(totalRevenue - totalCogs - totalFees - totalPackaging - totalShipping - totalExpenses - totalMileage);
  const taxReserve   = netProfit > 0 ? r2(netProfit * taxReservePct) : 0;
  const roi          = totalCogs > 0 ? r2((netProfit / totalCogs) * 100) : 0;

  const daysArr = soldItems
    .filter(i => i.sold_at && i.created_at)
    .map(i => Math.max(0, (new Date(i.sold_at as string).getTime() - new Date(i.created_at as string).getTime()) / 86400000));
  const avgDaysToSell = daysArr.length > 0 ? r2(daysArr.reduce((a, b) => a + b, 0) / daysArr.length) : 0;

  return {
    totalRevenue:   r2(totalRevenue),   totalCogs:      r2(totalCogs),
    totalFees:      r2(totalFees),      totalShipping:  r2(totalShipping),
    totalPackaging: r2(totalPackaging), totalExpenses:  r2(totalExpenses),
    totalMileage:   r2(totalMileage),   netProfit,      taxReserve,    roi,
    avgDaysToSell,  itemsSold: soldItems.length,
    itemsListed:   allItems.filter(i => i.status === 'Listed').length,
    itemsUnlisted: allItems.filter(i => i.status === 'Unlisted').length,
    periodLabel,
  };
}

async function handleStatsSummary(
  supabase: ReturnType<typeof createClient>,
  userId: number,
  settings: Settings,
  body: Record<string, unknown>,
) {
  const period = (body.period as string) ?? 'all';
  let periodLabel = 'All Time';
  let soldFilter = supabase.from('inventory').select('*').eq('user_id', userId).eq('status', 'Sold');
  if (period === 'month') {
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    soldFilter = soldFilter.gte('sold_at', start.toISOString());
    periodLabel = 'This Month';
  } else if (period === 'last30') {
    soldFilter = soldFilter.gte('sold_at', new Date(Date.now() - 30 * 86400000).toISOString());
    periodLabel = 'Last 30 Days';
  }

  const { data: soldItems } = await soldFilter;
  const { data: allItems }  = await supabase.from('inventory').select('status, sell_price, cost, sold_at, created_at').eq('user_id', userId);
  const { data: expenses }  = await supabase.from('pnl_expenses').select('*').eq('user_id', userId);

  const summary = calcPnlServer(
    soldItems ?? [], allItems ?? [], expenses ?? [],
    settings as Settings & { tax_reserve_pct?: number; mileage_rate?: number },
    periodLabel,
  );
  return { summary };
}

async function handleExpensesList(supabase: ReturnType<typeof createClient>, userId: number) {
  const { data, error } = await supabase.from('pnl_expenses')
    .select('*').eq('user_id', userId).order('date', { ascending: false });
  if (error) throw new Error(error.message);
  return { expenses: data ?? [] };
}

async function handleExpensesAdd(
  supabase: ReturnType<typeof createClient>,
  userId: number,
  body: Record<string, unknown>,
) {
  const amount   = Number(body.amount ?? 0);
  const category = (body.category as string) ?? 'other';
  const date     = (body.date as string) ?? new Date().toISOString().slice(0, 10);
  if (amount <= 0) throw new Error('Amount must be greater than 0');

  const { data, error } = await supabase.from('pnl_expenses').insert({
    user_id:     userId,
    amount,
    category,
    description: body.description ?? null,
    date,
    miles:       body.miles != null ? Number(body.miles) : null,
  }).select('*').single();

  if (error) throw new Error(error.message);
  return { expense: data };
}

function mapAction(raw: string): 'relist' | 'drop_price' | 'bundle' | 'donate' {
  const s = raw.toLowerCase();
  if (s.includes('drop') || s.includes('price')) return 'drop_price';
  if (s.includes('bundle')) return 'bundle';
  if (s.includes('donate')) return 'donate';
  return 'relist';
}

async function handleGrowthReport(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  userId: number,
  settings: Settings,
  forceRefresh: boolean,
) {
  // Check cache first — stored at cache_data.growth_report
  const { data: cacheRow } = await supabase.from('growth_cache')
    .select('cache_data').eq('user_id', userId).maybeSingle();

  const cacheData = (cacheRow?.cache_data ?? {}) as Record<string, unknown>;
  const cached = cacheData.growth_report as (Record<string, unknown> & { generatedAt?: string }) | null;

  if (!forceRefresh && cached?.generatedAt) {
    const ageHours = (Date.now() - new Date(cached.generatedAt as string).getTime()) / 3600000;
    if (ageHours < 24) return { cached: true, data: cached, generatedAt: cached.generatedAt };
  }

  // Pull inventory stats per category
  const { data: catRows } = await supabase.from('inventory')
    .select('category, cost, sell_price, status')
    .eq('user_id', userId);

  const items = catRows ?? [];
  const itemCount = items.length;

  // Build category stats
  const catMap: Record<string, { count: number; revenue: number; cogs: number; sold: number }> = {};
  for (const row of items) {
    const cat = (row.category as string) ?? 'Other';
    if (!catMap[cat]) catMap[cat] = { count: 0, revenue: 0, cogs: 0, sold: 0 };
    catMap[cat].count++;
    if (row.status === 'Sold') {
      catMap[cat].sold++;
      catMap[cat].revenue += Number(row.sell_price ?? 0);
      catMap[cat].cogs    += Number(row.cost ?? 0);
    }
  }
  const categoryStats = Object.entries(catMap).map(([cat, s]) => ({
    category: cat, item_count: s.count, sold_count: s.sold,
    avg_cost: s.count > 0 ? s.cogs / s.count : 0,
    total_profit: s.revenue - s.cogs,
  })).sort((a, b) => b.total_profit - a.total_profit);

  // Pull sold totals — §5.3: include eBay fees + packaging so AI sees real profit
  const sold = items.filter(r => r.status === 'Sold');
  const revenue = sold.reduce((s, r) => s + Number(r.sell_price ?? 0), 0);
  const cogs    = sold.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const ebayFees = revenue * ((settings.ebay_fee ?? 13) / 100);
  const pkgFees  = sold.length * (settings.pkg_cost ?? 1.25);

  // Pull stale items (>60 days)
  const maxDays = (settings as unknown as Record<string, unknown>).stale_days
    ? Number((settings as unknown as Record<string, unknown>).stale_days)
    : 60;
  const cutoff = new Date(Date.now() - maxDays * 86400000).toISOString();
  const { data: staleRows } = await supabase.from('inventory')
    .select('sku, nickname, created_at')
    .eq('user_id', userId)
    .in('status', ['Unlisted', 'Listed'])
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(5);

  const staleItems = (staleRows ?? []).map(r => ({
    sku: r.sku ?? '',
    nickname: sanitizeForPrompt(r.nickname ?? 'Unknown', 100),
    days: Math.floor((Date.now() - new Date(r.created_at as string).getTime()) / 86400000),
  }));

  // Pull top scanned categories (last 30 days)
  const { data: scanRows } = await supabase.from('scan_log')
    .select('category')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());

  const scanCatMap: Record<string, number> = {};
  for (const r of scanRows ?? []) {
    const c = (r.category as string) ?? 'Other';
    scanCatMap[c] = (scanCatMap[c] ?? 0) + 1;
  }
  const topScanCats = Object.entries(scanCatMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([category, scan_count]) => ({ category, scan_count }));

  const inventorySummary = {
    total_items: itemCount,
    total_revenue: Math.round(revenue * 100) / 100,
    total_cogs: Math.round(cogs * 100) / 100,
    net_profit: Math.round((revenue - cogs - ebayFees - pkgFees) * 100) / 100,
    sold_count: sold.length,
    category_stats: categoryStats.slice(0, 8),
    stale_items: staleItems,
    top_scan_categories: topScanCats,
  };

  if (!anthropicKey) {
    return { cached: false, data: buildFallbackReport(itemCount), generatedAt: new Date().toISOString() };
  }

  // Verbatim from FEATURE_TRIAGE.md F-27 P-05 (L3279–3307)
  const prompt = `You are a business growth advisor for an eBay thrift reseller. Analyze their data and provide actionable insights.

SELLER INVENTORY DATA:
${JSON.stringify(inventorySummary, null, 2)}

SELLER FEE STRUCTURE: ${settings.ebay_fee}% eBay fee + $${settings.pkg_cost} packaging per item. Minimum profit target: $${settings.min_profit}. Target ROI: ${settings.target_roi}%. Max days to sell: ${maxDays}.

TODAY'S DATE: ${new Date().toLocaleDateString()}

Based on this real seller data AND your knowledge of current eBay reselling trends for thrift sellers in 2025-2026, return ONLY valid JSON (no markdown, no preamble):
{
  "business_score": number (0-100),
  "score_label": "Strong/Growing/Steady/Needs Attention",
  "score_color": "#00e676 or #f5a623 or #ff3333",
  "score_summary": "one sentence on overall business health using their actual numbers",
  "top_categories": [
    {"name":"string","profit":"$X","insight":"one sentence specific to their data","bar_pct":number}
  ],
  "stale_actions": [
    {"sku":"string","name":"string","days":number,"action":"Relist / Drop price 10% / Bundle / Donate","reason":"one sentence"}
  ],
  "hunt_list": [
    {"icon":"emoji","item":"string","why":"one sentence why to hunt this now","priority":"HIGH or MED"}
  ],
  "market_trends": [
    {"arrow":"📈 or 📉","category":"string","detail":"one sentence trend insight for thrift resellers"}
  ],
  "advisor_message": "3-4 sentences of direct actionable advice using their actual numbers. Be specific. Tell them exactly what to do differently this week."
}`;

  let ai: Record<string, unknown>;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error?.message ?? 'Anthropic error');
    ai = JSON.parse(d.content[0].text as string);
  } catch {
    return { cached: false, data: buildFallbackReport(itemCount), generatedAt: new Date().toISOString() };
  }

  // Normalize AI response → GrowthReport shape
  const catStatsByName: Record<string, typeof categoryStats[number]> = {};
  for (const c of categoryStats) catStatsByName[c.category] = c;

  const report = {
    business_score: Number(ai.business_score ?? 50),
    score_label:    String(ai.score_label ?? 'Steady'),
    score_color:    String(ai.score_color ?? '#f5a623'),
    score_summary:  String(ai.score_summary ?? ''),
    top_categories: ((ai.top_categories as unknown[]) ?? []).slice(0, 3).map((c: unknown) => {
      const cat = c as Record<string, unknown>;
      const profitStr = String(cat.profit ?? '0').replace(/[^0-9.-]/g, '');
      const dbCat = catStatsByName[String(cat.name ?? '')] ?? null;
      return {
        name:       String(cat.name ?? ''),
        profit:     parseFloat(profitStr) || 0,
        sold_count: dbCat?.sold_count ?? 0,
        insight:    String(cat.insight ?? ''),
      };
    }),
    stale_actions: ((ai.stale_actions as unknown[]) ?? []).slice(0, 5).map((s: unknown) => {
      const row = s as Record<string, unknown>;
      return {
        sku:         String(row.sku ?? ''),
        nickname:    String(row.name ?? row.nickname ?? 'Unknown'),
        days_listed: Number(row.days ?? 0),
        action:      mapAction(String(row.action ?? 'relist')),
        suggestion:  String(row.reason ?? ''),
      };
    }),
    hunt_list: ((ai.hunt_list as unknown[]) ?? []).slice(0, 5).map((h: unknown) => {
      const row = h as Record<string, unknown>;
      return {
        item:     String(row.item ?? ''),
        priority: (String(row.priority ?? 'MED').toUpperCase() === 'HIGH' ? 'HIGH' : 'MED') as 'HIGH' | 'MED',
        reason:   String(row.why ?? row.reason ?? ''),
        icon:     String(row.icon ?? ''),
      };
    }),
    market_trends: ((ai.market_trends as unknown[]) ?? []).slice(0, 4).map((m: unknown) => {
      const row = m as Record<string, unknown>;
      const arrow = String(row.arrow ?? '');
      return {
        category:  String(row.category ?? ''),
        direction: (arrow.includes('📈') ? 'up' : 'down') as 'up' | 'down',
        reasoning: String(row.detail ?? row.reasoning ?? ''),
      };
    }),
    advisor_message: String(ai.advisor_message ?? ''),
    generatedAt:     new Date().toISOString(),
    item_count:      itemCount,
  };

  // Save to growth_cache
  const newCacheData = { ...cacheData, growth_report: report };
  await supabase.from('growth_cache').upsert({
    user_id: userId, cache_data: newCacheData,
    generated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  }, { onConflict: 'user_id' });

  return { cached: false, data: report, generatedAt: report.generatedAt };
}

async function handleSettingsGet(
  supabase: ReturnType<typeof createClient>,
  userId: number,
  tier: string,
) {
  const { data: row, error } = await supabase
    .from('settings').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  const s = row ?? {};
  const settings = {
    id:            s.id ?? 0,
    userId,
    ebayFee:       Number(s.ebay_fee ?? 13),
    pkgCost:       Number(s.pkg_cost ?? 1.25),
    minProfit:     Number(s.min_profit ?? 15),
    targetRoi:     Number(s.target_roi ?? 200),
    maxDays:       Number(s.stale_days ?? 60),
    minStr:        Number(s.min_str ?? 0),
    shipping:      s.shipping ?? 'buyer',
    shipCost:      Number(s.ship_cost ?? 6.00),
    sourcingStyle: s.sourcing_style ?? 'balanced',
    taxReservePct: Number(s.tax_reserve_pct ?? 0.25),
    mileageRate:   Number(s.mileage_rate ?? 0.72),
    updatedAt:     s.updated_at ?? new Date().toISOString(),
  };
  return { success: true, settings, tier };
}

interface SettingsInput {
  ebayFee: number; pkgCost: number; shipCost: number; minProfit: number;
  targetRoi: number; maxDays: number; minStr: number;
  sourcingStyle: string; shipping: string;
}

function validateSettingsInput(s: SettingsInput): string | null {
  if (s.ebayFee < 0 || s.ebayFee > 50)   return 'ebayFee must be 0–50';
  if (s.pkgCost < 0)                       return 'pkgCost must be ≥ 0';
  if (s.shipCost < 0)                      return 'shipCost must be ≥ 0';
  if (s.minProfit < 0)                     return 'minProfit must be ≥ 0';
  if (s.targetRoi < 0 || s.targetRoi > 1000) return 'targetRoi must be 0–1000';
  if (s.maxDays < 1 || s.maxDays > 999)   return 'maxDays must be 1–999';
  if (s.minStr < 0 || s.minStr > 100)     return 'minStr must be 0–100';
  const validSourcing = ['conservative', 'balanced', 'aggressive'];
  if (!validSourcing.includes(s.sourcingStyle)) return 'Invalid sourcingStyle';
  const validShipping = ['buyer', 'seller'];
  if (!validShipping.includes(s.shipping)) return 'Invalid shipping';
  return null;
}

async function handleSettingsUpdate(
  supabase: ReturnType<typeof createClient>,
  userId: number,
  tier: string,
  body: Record<string, unknown>,
) {
  const s = body.settings as SettingsInput;
  if (!s) throw new HttpError('Missing settings payload', 400);
  const validationError = validateSettingsInput(s);
  if (validationError) throw new HttpError(validationError, 400);
  const { data, error } = await supabase.from('settings').upsert({
    user_id:       userId,
    ebay_fee:      s.ebayFee,
    pkg_cost:      s.pkgCost,
    ship_cost:     s.shipCost,
    min_profit:    s.minProfit,
    target_roi:    s.targetRoi,
    stale_days:    s.maxDays,
    min_str:       s.minStr,
    sourcing_style: s.sourcingStyle,
    shipping:      s.shipping,
    updated_at:    new Date().toISOString(),
  }, { onConflict: 'user_id' }).select().single();
  if (error) throw new Error(error.message);
  const row = data as Record<string, unknown>;
  const updated = {
    id:            row.id as number,
    userId,
    ebayFee:       Number(row.ebay_fee ?? s.ebayFee),
    pkgCost:       Number(row.pkg_cost ?? s.pkgCost),
    minProfit:     Number(row.min_profit ?? s.minProfit),
    targetRoi:     Number(row.target_roi ?? s.targetRoi),
    maxDays:       Number(row.stale_days ?? s.maxDays),
    minStr:        Number(row.min_str ?? s.minStr),
    shipping:      row.shipping ?? s.shipping,
    shipCost:      Number(row.ship_cost ?? s.shipCost),
    sourcingStyle: row.sourcing_style ?? s.sourcingStyle,
    taxReservePct: Number(row.tax_reserve_pct ?? 0.25),
    mileageRate:   Number(row.mileage_rate ?? 0.72),
    updatedAt:     row.updated_at as string,
  };
  return { success: true, settings: updated };
}

function buildFallbackReport(itemCount: number): Record<string, unknown> {
  return {
    business_score: 0, score_label: 'Needs Attention',
    score_color: '#ff3333',
    score_summary: 'Could not generate report — add more sold items for analysis.',
    top_categories: [], stale_actions: [], hunt_list: [], market_trends: [],
    advisor_message: 'List and sell a few items to unlock your weekly brief.',
    generatedAt: new Date().toISOString(), item_count: itemCount,
  };
}

const STATIC_KEYWORDS = [
  { rank: 1, word: 'vintage electronics', trend: 'up',     bar: 92 },
  { rank: 2, word: 'levi jeans',          trend: 'up',     bar: 88 },
  { rank: 3, word: 'retro gaming',        trend: 'up',     bar: 85 },
  { rank: 4, word: 'cast iron cookware',  trend: 'stable', bar: 78 },
  { rank: 5, word: 'nike shoes',          trend: 'up',     bar: 76 },
  { rank: 6, word: 'vintage camera',      trend: 'up',     bar: 72 },
  { rank: 7, word: 'band t shirt',        trend: 'stable', bar: 68 },
  { rank: 8, word: 'pokemon cards',       trend: 'stable', bar: 65 },
  { rank: 9, word: 'vintage pyrex',       trend: 'up',     bar: 62 },
  { rank: 10, word: 'tools hardware',     trend: 'stable', bar: 58 },
];
const STATIC_CATEGORIES = ['Electronics', 'Clothing', 'Collectibles', 'Home & Garden'];
const STATIC_TIP = 'Electronics with original boxes sell 30% faster — always include if available.';

// ── Legacy proxy: handles old Replit-style /v1/messages endpoints ──────────
function ab2b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 8192;
  let s = '';
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

async function handleLegacyProxy(req: Request, hasImage: boolean): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  const jwtSecret = Deno.env.get('JWT_SECRET');
  if (!jwtSecret) throw new Error('JWT_SECRET must be set');
  try { await verifyJWT(authHeader.slice(7), jwtSecret); }
  catch { return json({ error: 'Unauthorized' }, 401); }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  if (!anthropicKey) return json({ error: 'Anthropic key not configured' }, 500);

  let model: string, system: string, messages: unknown[], maxTokens: number;

  if (hasImage) {
    const form = await req.formData();
    model     = (form.get('model') as string) ?? 'claude-sonnet-4-6';
    system    = (form.get('system') as string) ?? '';
    maxTokens = parseInt((form.get('max_tokens') as string) ?? '1500', 10);
    messages  = JSON.parse((form.get('messages') as string) ?? '[]');
    const imageFile = form.get('image') as File | null;
    if (imageFile) {
      const b64 = ab2b64(await imageFile.arrayBuffer());
      if (Array.isArray(messages) && messages.length > 0) {
        const content = (messages[0] as Record<string, unknown>).content as Array<Record<string, unknown>>;
        const imgBlock = content?.find(b => b.type === 'image');
        if (imgBlock) (imgBlock.source as Record<string, unknown>).data = b64;
      }
    }
  } else {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    model     = (body.model as string) ?? 'claude-sonnet-4-6';
    system    = (body.system as string) ?? '';
    maxTokens = (body.max_tokens as number) ?? 1500;
    messages  = (body.messages as unknown[]) ?? [];
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.ok ? 200 : res.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Route old /v1/messages* endpoints to legacy transparent proxy
  const path = new URL(req.url).pathname;
  if (req.method === 'POST' && (path.endsWith('/v1/messages') || path.endsWith('/v1/messages-with-image'))) {
    return await handleLegacyProxy(req, path.endsWith('/v1/messages-with-image'));
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: Record<string, unknown>;
  const contentType = req.headers.get('Content-Type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    // Mobile clients upload the raw camera file directly (no client-side
    // base64/decode — avoids OOM on low-RAM Android WebViews). Convert to
    // base64 here, server-side, where memory isn't constrained.
    try {
      const form = await req.formData();
      const imageFile = form.get('image') as File | null;
      let b64 = '';
      let imageMime: string = 'image/jpeg';
      if (imageFile) {
        const buf = await imageFile.arrayBuffer();
        // Detect ISOBMFF container: bytes 4-7 are 'ftyp' (0x66 0x74 0x79 0x70).
        // Shared by HEIC, AVIF, MP4, MOV. Check bytes 8-11 for the actual brand.
        const hdr = new Uint8Array(buf, 0, 12);
        if (hdr[4] === 0x66 && hdr[5] === 0x74 && hdr[6] === 0x79 && hdr[7] === 0x70) {
          const brand = String.fromCharCode(hdr[8], hdr[9], hdr[10], hdr[11]).toLowerCase();
          const isHeic = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand);
          if (isHeic) {
            return json({ error: 'HEIC photos are not supported. On iPhone: Settings → Camera → Format → Most Compatible to save as JPEG.' }, 415);
          }
          // AVIF, MP4, MOV and other unsupported container formats
          return json({ error: 'This image format is not supported. Please use JPEG, PNG, or WebP.' }, 415);
        }
        b64 = ab2b64(buf);
        imageMime = detectImageMime(buf);
      }
      body = {
        type: form.get('type') as string,
        hint: form.get('hint') as string | null,
        imageBase64: b64,
        images: b64 ? [b64] : [],
        imageMimeTypes: b64 ? [imageMime] : [],
      };
    } catch {
      return json({ error: 'Invalid form data' }, 400);
    }
  } else {
    try { body = await req.json(); }
    catch { return json({ error: 'Invalid JSON body' }, 400); }
  }

  if (body.type === 'health') {
    return json({ status: 'ok', function: 'claude-proxy', ts: new Date().toISOString() });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  const token = authHeader.slice(7);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

  const jwtSecret = Deno.env.get('JWT_SECRET');
  if (!jwtSecret) throw new Error('JWT_SECRET must be set');

  let payload: Record<string, unknown>;
  try {
    payload = await verifyJWT(token, jwtSecret);
  } catch {
    return json({ error: 'Unauthorized' }, 401);
  }

  const email = (payload.email as string) ?? '';
  const username = ((payload.user_metadata as Record<string, unknown>)?.username as string) ?? '';

  let dbUser: Awaited<ReturnType<typeof getOrCreateUser>>;
  try { dbUser = await getOrCreateUser(supabase, email, username); }
  catch (e) { console.error('getOrCreateUser failed:', e); return json({ error: 'Internal error' }, 500); }

  // SEC-012 — reject sessions issued before the last password reset.
  if ((payload.token_version ?? 0) !== (dbUser.token_version ?? 0)) return json({ error: 'Unauthorized' }, 401);

  const isScan = body.type === 'single_scan' || body.type === 'shelf_scan';
  if (isScan) {
    // §5.1 — atomic increment + monthly reset + limit check in one RPC,
    // replacing the read-then-write race. p_limit null = unlimited.
    const limit = SCAN_LIMITS[dbUser.tier] ?? null;
    const { error: incErr } = await supabase.rpc('increment_scan_count', {
      p_user_id: dbUser.id,
      p_limit: limit,
    });
    if (incErr) {
      if (incErr.message?.includes('scan_limit_reached')) {
        return json({ error: 'scan_limit_reached', tier: dbUser.tier, limit, used: limit }, 429);
      }
      console.error('increment_scan_count error:', incErr);
      return json({ error: 'Scan service temporarily unavailable' }, 503);
    }
  }

  try {
    if (body.type === 'single_scan') {
      if (!anthropicKey) return json({ error: 'AI service not configured' }, 503);
      const imgs = Array.isArray(body.images) ? (body.images as string[])
        : body.imageBase64 ? [body.imageBase64 as string] : [];
      if (imgs.length === 0) return json({ error: 'No image provided' }, 400);
      const mimes = Array.isArray(body.imageMimeTypes) ? (body.imageMimeTypes as string[]) : [];
      return json(await handleSingleScan(supabase, anthropicKey, dbUser.id, dbUser.settings, imgs, mimes));
    }
    if (body.type === 'shelf_scan') {
      if (!anthropicKey) return json({ error: 'AI service not configured' }, 503);
      const imgs = Array.isArray(body.images) ? (body.images as string[])
        : body.imageBase64 ? [body.imageBase64 as string] : [];
      if (imgs.length === 0) return json({ error: 'No image provided' }, 400);
      const mimes = Array.isArray(body.imageMimeTypes) ? (body.imageMimeTypes as string[]) : [];
      return json(await handleShelfScan(supabase, anthropicKey, dbUser.id, dbUser.settings, imgs, mimes));
    }
    if (body.type === 'buy_item')         return json(await handleBuyItem(supabase, dbUser.id, dbUser.tier, body));
    if (body.type === 'inventory_list')   return json(await handleInventoryList(supabase, dbUser.id, dbUser.settings, dbUser.tier, Number(body.pageSize ?? 500), Number(body.pageOffset ?? 0)));
    if (body.type === 'inventory_create') return json(await handleInventoryCreate(supabase, dbUser.id, dbUser.tier, body));
    if (body.type === 'inventory_update') return json(await handleInventoryUpdate(supabase, dbUser.id, body));
    if (body.type === 'inventory_delete') return json(await handleInventoryDelete(supabase, dbUser.id, body));
    if (body.type === 'inventory_status')  return json(await handleInventoryStatus(supabase, dbUser.id, body));
    if (body.type === 'listing_generate') {
      if (!anthropicKey) return json({ error: 'AI service not configured' }, 503);
      return json(await handleListingGenerate(supabase, anthropicKey, dbUser.id, dbUser.settings, body));
    }
    if (body.type === 'keywords_get') {
      return json(await handleKeywordsGet(supabase, anthropicKey, dbUser.id));
    }
    if (body.type === 'growth_report')   return json(await handleGrowthReport(supabase, anthropicKey, dbUser.id, dbUser.settings, body.forceRefresh === true));
    if (body.type === 'stats_summary')  return json(await handleStatsSummary(supabase, dbUser.id, dbUser.settings, body));
    if (body.type === 'expenses_list')  return json(await handleExpensesList(supabase, dbUser.id));
    if (body.type === 'expenses_add')   return json(await handleExpensesAdd(supabase, dbUser.id, body));
    if (body.type === 'settings_get')   return json(await handleSettingsGet(supabase, dbUser.id, dbUser.tier));
    if (body.type === 'settings_update') return json(await handleSettingsUpdate(supabase, dbUser.id, dbUser.tier, body));

    // SEC-003: no unauthenticated Anthropic pass-through — reject unknown action types
    return json({ error: 'Unknown request type' }, 400);
  } catch (e) {
    if (e instanceof HttpError) {
      return json({ error: e.message, ...e.data }, e.httpStatus);
    }
    console.error('claude-proxy unhandled error:', e);
    return json({ error: 'Internal error' }, 500);
  }
});
