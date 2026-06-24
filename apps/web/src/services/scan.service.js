/**
 * AI scan service — photo and text scan via claude-proxy Edge Function.
 * Prompts ported verbatim from Flippd. Do not rewrite them.
 */

import { apiFetch, apiUpload, ENDPOINTS } from './http.js';

const SCAN_URL    = `${ENDPOINTS.CLAUDE}/scan`;
const CLAUDE_URL  = `${ENDPOINTS.CLAUDE}/v1/messages`;

/**
 * Build the single-item analysis system prompt.
 * Settings injected so the prompt reflects the user's actual fee structure.
 * @param {{ ebayFee: number, pkgCost: number, minProfit: number }} settings
 * @returns {string}
 */
export function getSingleSysPrompt(settings) {
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

This seller's fee structure: ${settings.ebayFee}% eBay fee + $${settings.pkgCost} packaging. Buyer always pays shipping.
Minimum profitable sale for this seller: their cost + fees + $${settings.minProfit} profit.

Return ONLY valid JSON, no markdown:
{"item_name":"specific make model and variant","category":"string","brand":"string or null","model_number":"string or null","estimated_weight_lbs":number,"avg_sold_price":number,"price_low":number,"price_high":number,"sell_through_rate":number,"avg_days_to_sell":number,"demand_level":"LOW|MEDIUM|HIGH|VERY HIGH","confidence":number,"confidence_reason":"what you confirmed and what you could not","condition_notes":"visible condition issues","search_keywords":["4 specific eBay search terms for this exact item"],"listing_tips":["4 actionable selling tips"],"risk_flags":["red flags or empty array"],"notes":"important context about market or item"}`;
}

/**
 * Build the shelf-scan system prompt.
 * @returns {string}
 */
export function getShelfSysPrompt() {
  return `You are an expert eBay reseller analyzing a shelf of thrift store items. Identify ALL visible items with resale potential.

For EACH item found, provide:
- item_name: exact make/model/variant (not generic)
- category: one of Electronics|Clothing|Shoes|Home & Garden|Collectibles|Toys & Hobbies|Sporting Goods|Books|Automotive|Health & Beauty|Tools|Musical Instruments|Pet Supplies|Baby|Jewelry & Watches
- avg_sold_price: median recent eBay SOLD price (not retail, not asking)
- confidence: 0-100 (how certain you are of the identification)
- flip_score: 1-10 (overall resale value score)
- reason: 1-2 sentence explanation of why this is worth flipping

Return ONLY valid JSON array, no markdown:
[{"item_name":"...","category":"...","avg_sold_price":number,"confidence":number,"flip_score":number,"reason":"..."}]

Focus on items likely to sell for $15+ profit. Skip obvious worthless items. Order by flip_score descending.`;
}

/**
 * Photo scan via multipart upload (avoids base64 OOM on low-RAM Android).
 * @param {'single_scan'|'shelf_scan'} type
 * @param {string} hint - user text hint
 * @param {File} file - the image file
 * @returns {Promise<object>}
 */
export async function scanWithPhoto(type, hint, file) {
  const form = new FormData();
  form.append('type', type);
  form.append('hint', hint);
  form.append('image', file, file.name ?? 'photo.jpg');
  return apiUpload(SCAN_URL, form);
}

/**
 * Text-only scan via Claude proxy.
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {number} [maxTokens]
 * @returns {Promise<object>} parsed JSON from Claude
 */
export async function scanWithText(systemPrompt, userMessage, maxTokens = 1500) {
  const data = await apiFetch(CLAUDE_URL, {
    method: 'POST',
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const raw = data?.content?.[0]?.text ?? data?.text ?? '';
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(raw);
  } catch (e) {
    throw new Error('Could not parse AI response: ' + raw.slice(0, 200));
  }
}

/**
 * Compress an image File to ~1600px before upload (prevents OOM on Android WebView).
 * Falls back to original file if createImageBitmap is unavailable.
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function compressForUpload(file) {
  const MAX_DIMENSION = 1600;
  const JPEG_QUALITY  = 0.85;

  try {
    const bitmap  = await createImageBitmap(file);
    const { width, height } = bitmap;
    const ratio  = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height, 1);

    if (ratio >= 1) return file; // already small enough

    const canvas = new OffscreenCanvas(
      Math.round(width  * ratio),
      Math.round(height * ratio),
    );
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
    return new File([blob], file.name ?? 'photo.jpg', { type: 'image/jpeg' });
  } catch (_) {
    return file; // fallback — old WebView without OffscreenCanvas
  }
}

/**
 * Stitch multiple photos into a single side-by-side composite for shelf scans.
 * @param {File[]} files
 * @returns {Promise<File>}
 */
export async function stitchPhotos(files) {
  const TARGET_H = 800;
  const bitmaps  = await Promise.all(files.map(f => createImageBitmap(f)));

  const totalW = bitmaps.reduce((sum, b) => sum + Math.round(b.width * TARGET_H / b.height), 0);
  const canvas = new OffscreenCanvas(totalW, TARGET_H);
  const ctx    = canvas.getContext('2d');

  let x = 0;
  for (const bmp of bitmaps) {
    const w = Math.round(bmp.width * TARGET_H / bmp.height);
    ctx.drawImage(bmp, x, 0, w, TARGET_H);
    x += w;
  }

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  return new File([blob], 'shelf.jpg', { type: 'image/jpeg' });
}
