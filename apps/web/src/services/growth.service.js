/**
 * Growth Agent service — weekly business brief and trending keywords.
 * AI calls proxied through claude-proxy Edge Function.
 */

import { apiFetch, ENDPOINTS } from './http.js';

const CLAUDE_URL = `${ENDPOINTS.CLAUDE}/v1/messages`;

/**
 * Run the Growth Agent weekly analysis.
 * @param {{ items: object[], scanLog: object[], settings: object }} context
 * @returns {Promise<object>} structured growth report
 */
export async function runGrowthAgent(context) {
  const { items, scanLog, settings } = context;

  const soldItems    = items.filter(i => i.status === 'Sold');
  const listedItems  = items.filter(i => i.status === 'Listed');
  const staleItems   = listedItems.filter(i => {
    const days = Math.floor((Date.now() - new Date(i.dateAcquired)) / 86_400_000);
    return days > (settings.maxDays ?? 60);
  });

  const totalRevenue = soldItems.reduce((s, i) => s + (parseFloat(i.soldPrice) || parseFloat(i.sellPrice) || 0), 0);
  const totalCogs    = soldItems.reduce((s, i) => s + (parseFloat(i.cost) || 0), 0);

  const systemPrompt = `You are a weekly business coach for eBay resellers. Analyze this seller's data and give them a practical weekly brief.

Return ONLY valid JSON:
{
  "weekly_score": number (1-100, overall business health),
  "revenue_insight": "string (1-2 sentences about revenue trend)",
  "top_categories": ["cat1","cat2","cat3"],
  "stale_alert": "string or null (flag items sitting too long)",
  "action_items": ["3-5 specific actions for this week"],
  "motivational_note": "string (brief encouragement)",
  "keywords_to_watch": ["5 trending eBay search terms in their categories"]
}`;

  const userMessage = `Seller data:
- Total inventory: ${items.length} items
- Listed: ${listedItems.length} | Sold: ${soldItems.length} | Stale (>${settings.maxDays ?? 60}d): ${staleItems.length}
- Total revenue (sold): $${totalRevenue.toFixed(2)}
- Total COGS: $${totalCogs.toFixed(2)}
- Scans this period: ${scanLog.length}
- Categories in inventory: ${[...new Set(items.map(i => i.category))].join(', ')}
- Stale item SKUs: ${staleItems.slice(0, 5).map(i => i.sku).join(', ') || 'none'}`;

  const data = await apiFetch(CLAUDE_URL, {
    method: 'POST',
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const raw = data?.content?.[0]?.text ?? '';
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(raw);
  } catch (_) {
    throw new Error('Could not parse Growth Agent response');
  }
}

/**
 * Fetch trending eBay keywords for the user's top categories.
 * @param {string[]} categories
 * @returns {Promise<Array<{ keyword: string, trend: string, category: string }>>}
 */
export async function fetchTrendingKeywords(categories) {
  const systemPrompt = `You are an eBay marketplace analyst. Return trending search keywords for resellers in these categories.

Return ONLY valid JSON array:
[{"keyword":"string","trend":"rising|stable|cooling","category":"string","tip":"1 sentence selling tip"}]

Return 10-15 keywords total.`;

  const userMessage = `Categories to analyze: ${categories.join(', ')}
Focus on niche keywords with high sell-through rates, not generic terms.`;

  const data = await apiFetch(CLAUDE_URL, {
    method: 'POST',
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const raw = data?.content?.[0]?.text ?? '';
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (_) {
    return [];
  }
}
