import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Item limits per tier ────────────────────────────────────────────────────
const ITEM_LIMITS: Record<string, number | null> = {
  trial: null, scout: 10, hustle: 500, stack: null, empire: null,
};

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

const SCAN_LIMITS: Record<string, number | null> = {
  trial: null, scout: 25, hustle: null, stack: null, empire: null,
};

type Settings = typeof DEFAULT_SETTINGS;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Supabase JWTs: sub = UUID string, email at top level
async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown>> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [header, payload, sig] = parts;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const sigBytes = Uint8Array.from(
    atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)
  );
  const valid = await crypto.subtle.verify(
    'HMAC', key, sigBytes, new TextEncoder().encode(`${header}.${payload}`)
  );
  if (!valid) throw new Error('Invalid signature');
  const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  if (data.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return data;
}

// Look up or lazily create the users row by email.
// Bridges Supabase Auth (UUID sub) → custom users table (integer id).
async function getOrCreateUser(
  supabase: ReturnType<typeof createClient>,
  email: string,
  username: string,
): Promise<{ id: number; tier: string; scan_count_month: number; scan_reset_date: string; settings: Settings; }> {
  const { data: existing } = await supabase
    .from('users').select('id, tier, scan_count_month, scan_reset_date')
    .eq('email', email).maybeSingle();

  let user = existing;
  if (!user) {
    const { data: created, error } = await supabase
      .from('users')
      .insert({ email, username: username || email.split('@')[0], password: 'supabase_auth', is_verified: true })
      .select('id, tier, scan_count_month, scan_reset_date').single();
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

function getDecision(roi: number, confidence: number, s: Settings): 'BUY' | 'HOT' | 'PASS' {
  const mod = s.sourcing_style === 'conservative' ? 1.2 : s.sourcing_style === 'aggressive' ? 0.8 : 1.0;
  const target = s.target_roi * mod;
  if (roi > 150 && confidence >= 80) return 'HOT';
  if (roi > target && confidence >= 50) return 'BUY';
  return 'PASS';
}

async function callAnthropic(
  key: string, system: string, imageBase64: string, maxTokens = 1024,
): Promise<string> {
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
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
          { type: 'text', text: 'Analyze this image.' },
        ],
      }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? 'Anthropic error');
  return data.content[0].text as string;
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
[{"item_name":"specific name with brand and model","category":"string","brand":"string or null","avg_sold_price":number,"estimated_cost_at_thrift":number,"sell_through_rate":number,"avg_days_to_sell":number,"demand_level":"LOW|MEDIUM|HIGH|VERY HIGH","decision":"BUY|HOT|PASS","decision_reason":"one specific sentence with reasoning","estimated_profit":number,"confidence":number,"condition_notes":"string"}]
Sort: HOT first, then BUY, then PASS.`;
}

async function handleSingleScan(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  userId: number,
  settings: Settings,
  imageBase64: string,
) {
  const raw = await callAnthropic(anthropicKey, buildSinglePrompt(settings), imageBase64);
  let ai: Record<string, unknown>;
  try { ai = JSON.parse(raw); }
  catch { throw new Error('AI returned invalid JSON'); }

  const avgSell = (ai.avg_sold_price as number) ?? 0;
  const estimatedCost = r2(avgSell * 0.10); // ~typical thrift store cost for display
  const { net, roi } = calcProfit(avgSell, estimatedCost, settings.pkg_cost, settings.ship_cost, settings.ebay_fee);
  const confidence = (ai.confidence as number) ?? 50;
  const decision = getDecision(roi, confidence, settings);

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
    category: ai.category, searchKeywords: ai.search_keywords ?? [],
    priceLow: ai.price_low, priceHigh: ai.price_high,
    avgDaysToSell: ai.avg_days_to_sell, demandLevel: ai.demand_level,
    listingTips: ai.listing_tips ?? [], riskFlags: ai.risk_flags ?? [],
    conditionNotes: ai.condition_notes ?? '', scanLogId: logRow?.id ?? null,
  };
}

async function handleShelfScan(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  userId: number,
  settings: Settings,
  imageBase64: string,
) {
  const raw = await callAnthropic(anthropicKey, buildShelfPrompt(settings), imageBase64, 2048);
  let aiItems: Record<string, unknown>[];
  try { aiItems = JSON.parse(raw); }
  catch { throw new Error('AI returned invalid JSON'); }
  if (!Array.isArray(aiItems)) throw new Error('AI returned non-array for shelf scan');

  const items = aiItems.map((ai) => {
    const sell = (ai.avg_sold_price as number) ?? 0;
    const cost = (ai.estimated_cost_at_thrift as number) ?? r2(sell * 0.10);
    const { net, roi } = calcProfit(sell, cost, settings.pkg_cost, settings.ship_cost, settings.ebay_fee);
    const confidence = (ai.confidence as number) ?? 50;
    const decision = getDecision(roi, confidence, settings);
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
  body: Record<string, unknown>,
) {
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
) {
  const { data: items, error } = await supabase
    .from('inventory').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const { count } = await supabase
    .from('inventory').select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return { items: items ?? [], itemCount: count ?? 0, settings, tier };
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
  'Unlisted':        ['Listed'],
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
    if (body.actualSellPrice != null) updates.sell_price = body.actualSellPrice;
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
  const nickname  = (body.nickname  as string) ?? 'Unknown item';
  const category  = (body.category  as string) ?? 'Other';
  const condition = (body.condition as string) ?? 'Used';
  const notes     = (body.notes     as string) ?? '';
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

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

  let payload: Record<string, unknown>;
  try {
    payload = await verifyJWT(token, Deno.env.get('JWT_SECRET') ?? 'dev-secret-replace-in-production');
  } catch {
    return json({ error: 'Unauthorized' }, 401);
  }

  const email = (payload.email as string) ?? '';
  const username = ((payload.user_metadata as Record<string, unknown>)?.username as string) ?? '';

  let dbUser: Awaited<ReturnType<typeof getOrCreateUser>>;
  try { dbUser = await getOrCreateUser(supabase, email, username); }
  catch (e) { return json({ error: (e as Error).message }, 500); }

  const isScan = body.type === 'single_scan' || body.type === 'shelf_scan';
  if (isScan) {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const lastReset = (dbUser.scan_reset_date ?? '').slice(0, 7);
    let scanCount = dbUser.scan_count_month ?? 0;
    if (lastReset < thisMonth) {
      scanCount = 0;
      await supabase.from('users').update({
        scan_count_month: 0, scan_reset_date: new Date().toISOString().slice(0, 10),
      }).eq('id', dbUser.id);
    }
    const limit = SCAN_LIMITS[dbUser.tier];
    if (limit !== null && scanCount >= limit) {
      return json({ error: 'scan_limit_reached', tier: dbUser.tier, limit, used: scanCount }, 429);
    }
    await supabase.from('users').update({ scan_count_month: scanCount + 1 }).eq('id', dbUser.id);
  }

  try {
    if (body.type === 'single_scan') {
      if (!anthropicKey) return json({ error: 'AI service not configured' }, 503);
      return json(await handleSingleScan(supabase, anthropicKey, dbUser.id, dbUser.settings, body.imageBase64 as string));
    }
    if (body.type === 'shelf_scan') {
      if (!anthropicKey) return json({ error: 'AI service not configured' }, 503);
      return json(await handleShelfScan(supabase, anthropicKey, dbUser.id, dbUser.settings, body.imageBase64 as string));
    }
    if (body.type === 'buy_item')         return json(await handleBuyItem(supabase, dbUser.id, body));
    if (body.type === 'inventory_list')   return json(await handleInventoryList(supabase, dbUser.id, dbUser.settings, dbUser.tier));
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

    // Pass-through for other claude calls
    if (!anthropicKey) return json({ error: 'AI service not configured' }, 503);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return json({ error: e.message, ...e.data }, e.httpStatus);
    }
    return json({ error: (e as Error).message ?? 'Internal error' }, 500);
  }
});
