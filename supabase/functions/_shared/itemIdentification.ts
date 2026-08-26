// Provider-agnostic item identification (task doc §1). Identification must
// not be architected around any single AI vendor — this boundary lets
// vision/reasoning providers be swapped without touching financial or
// market-data logic. AI confidence here is IDENTITY confidence only; it can
// never inject an authoritative price, STR, demand, or decision.
//
// Preferred evidence order (task doc): barcode/GTIN/UPC/EAN/ISBN > exact
// model/MPN > OCR label text > eBay Catalog match > verified brand+model+
// variant > visual AI > generic text/AI inference. This module currently
// implements only the visual-AI rung (no barcode scanner or OCR pipeline
// exists in the live app yet) — see session report "Out-of-Scope Findings".
import type { IdentityCandidate, IdentificationEvidenceKind } from "./marketData.ts"

export interface IdentifyInput {
  images: string[]                 // base64, no data: prefix
  mimeTypes: ('image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')[]
  userSuppliedText?: string        // e.g. a barcode string or free-text description
}

export interface ItemIdentifier {
  readonly providerId: string
  identify(input: IdentifyInput): Promise<IdentityCandidate>
}

const IDENTIFY_SYSTEM_PROMPT = `You identify physical items from photos for resale sourcing. You do NOT price items, estimate demand, or make buy/sell decisions — another deterministic system does that from verified marketplace data. Your only job is identification.

Study every visible detail: brand logos, model numbers on labels/tags/serial plates, barcodes, color, size, materials, distinctive design features. Read any visible text precisely — do not guess a model number you cannot actually read.

Return ONLY valid JSON, no markdown:
{"item_name":"specific make/model/variant or null if unidentifiable","brand":"string or null","model":"string or null","variant":"string or null","gtin":"barcode/UPC/EAN/ISBN digits if visible, else null","manufacturer_part_number":"string or null","likely_ebay_category":"string or null","category_hints":["string"],"condition_hints":"visible condition notes or null","unresolved_attributes":["what you could not determine"],"identity_confidence":number,"evidence_used":["ocr_label","visual_ai", "..."],"normalized_search_terms":["2-5 precise search terms for this exact item"]}`;

async function callAnthropicVision(apiKey: string, input: IdentifyInput): Promise<Record<string, unknown>> {
  const imageBlocks = input.images.map((data, i) => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: input.mimeTypes[i] ?? 'image/jpeg', data },
  }));
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 768,
      system: IDENTIFY_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          ...imageBlocks,
          { type: 'text', text: input.userSuppliedText ?? 'Identify this item.' },
        ],
      }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? 'Anthropic identification error');
  const raw = (data.content[0].text as string).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(raw);
}

function toIdentityCandidate(ai: Record<string, unknown>, providerId: string): IdentityCandidate {
  const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
  const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const evidenceUsed = strArr(ai.evidence_used).filter(
    (e): e is IdentificationEvidenceKind =>
      ['barcode', 'gtin', 'upc', 'ean', 'isbn', 'model_number', 'manufacturer_part_number',
        'ocr_label', 'catalog_match', 'verified_attributes', 'visual_ai', 'text_inference'].includes(e),
  );

  return {
    itemName: str(ai.item_name),
    brand: str(ai.brand),
    model: str(ai.model),
    variant: str(ai.variant),
    gtin: str(ai.gtin),
    gtinKind: str(ai.gtin) ? inferGtinKind(str(ai.gtin)!) : null,
    manufacturerPartNumber: str(ai.manufacturer_part_number),
    likelyEbayCategory: str(ai.likely_ebay_category),
    categoryHints: strArr(ai.category_hints),
    conditionHints: str(ai.condition_hints),
    unresolvedAttributes: strArr(ai.unresolved_attributes),
    identityConfidence: typeof ai.identity_confidence === 'number' ? ai.identity_confidence : 0,
    evidenceUsed: evidenceUsed.length ? evidenceUsed : ['visual_ai'],
    normalizedSearchTerms: strArr(ai.normalized_search_terms),
    providerId,
  };
}

function inferGtinKind(gtin: string): 'GTIN' | 'UPC' | 'EAN' | 'ISBN' | null {
  const digits = gtin.replace(/[^0-9]/g, '');
  if (digits.length === 10 || digits.length === 13) return 'ISBN';
  if (digits.length === 12) return 'UPC';
  if (digits.length === 13) return 'EAN';
  if (digits.length === 14) return 'GTIN';
  return null;
}

export class ClaudeVisionIdentifier implements ItemIdentifier {
  readonly providerId = 'anthropic-claude-vision';
  constructor(private readonly apiKey: string) {}

  async identify(input: IdentifyInput): Promise<IdentityCandidate> {
    const ai = await callAnthropicVision(this.apiKey, input);
    return toIdentityCandidate(ai, this.providerId);
  }
}

// Not yet wired to a live key in this repo (no OPENAI_API_KEY/GEMINI_API_KEY
// secret exists) — present so the provider boundary is real, not aspirational,
// and a future session can drop in the fetch call without redesigning the
// interface. Throws clearly rather than silently no-op-ing if selected.
export class OpenAiVisionIdentifier implements ItemIdentifier {
  readonly providerId = 'openai-vision';
  identify(): Promise<IdentityCandidate> {
    throw new Error('OpenAiVisionIdentifier is not implemented — no OPENAI_API_KEY configured. Provider boundary only.');
  }
}

export class GeminiVisionIdentifier implements ItemIdentifier {
  readonly providerId = 'gemini-vision';
  identify(): Promise<IdentityCandidate> {
    throw new Error('GeminiVisionIdentifier is not implemented — no GEMINI_API_KEY configured. Provider boundary only.');
  }
}

// Selects the active identification provider from config. Defaults to
// Claude only because it's the only one with a configured key today — this
// is a config choice, not an architectural commitment to Anthropic.
export function getItemIdentifier(): ItemIdentifier | null {
  const provider = Deno.env.get('IDENTIFICATION_PROVIDER') ?? 'anthropic';
  if (provider === 'anthropic') {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    return key ? new ClaudeVisionIdentifier(key) : null;
  }
  if (provider === 'openai') return new OpenAiVisionIdentifier();
  if (provider === 'gemini') return new GeminiVisionIdentifier();
  return null;
}
