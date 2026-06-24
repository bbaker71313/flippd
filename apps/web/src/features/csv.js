/**
 * Listing generator + CSV feature controller.
 *
 * Manages the per-item listing modal (AI title/description generation)
 * and the legacy "Ready to Export" CSV download path.
 *
 * The new multi-item CSV panel lives in ui/csv/CsvPanel.js.
 * This module owns: modal state, AI generation, saveListing(), exportListingsToCSV().
 */

import { getItems, updateItem }  from '../state/ItemsSlice.js';
import { getSettings }           from '../state/SettingsSlice.js';
import { scanWithText }          from '../services/scan.service.js';
import { getEbayCatId, EBAY_CONDITION_IDS } from '../core/categories.js';
import { showToast }             from '../ui/components/Toast.js';

// ── Modal state ───────────────────────────────────────────────────────────

/** @type {{ itemId: number|null, stage: string, condition: string, ebayCategory: string, generatedListing: object|null }} */
let _modal = {
  itemId: null, stage: 'selection', condition: '', ebayCategory: '', generatedListing: null,
};

// eBay category defaults keyed by SFP category name (matches original EBAY_CAT_DEFAULTS)
const CAT_DEFAULTS = {
  'Electronics': '293', 'Clothing': '11450', 'Shoes': '63889',
  'Home & Garden': '11700', 'Collectibles': '1', 'Toys & Hobbies': '220',
  'Books': '267', 'Sporting Goods': '888', 'Jewelry & Watches': '281',
  'Music': '11233', 'Movies & TV': '11232', 'Video Games': '1249',
  'Tools & Hardware': '631', 'Automotive': '6000', 'Baby': '2984',
  'Health & Beauty': '26395', 'Pet Supplies': '1281', 'Art': '550',
  'Cameras': '625', 'Office': '2979', 'Other': '99',
};

// ── Modal open / close ────────────────────────────────────────────────────

export function openListingModal(itemId) {
  const item = getItems().find(i => i.id === itemId);
  if (!item) return;
  _modal = { itemId, stage: 'selection', condition: item.condition || 'Used', ebayCategory: '', generatedListing: null };
  _showSelectionStage();
  const el = document.getElementById('listing-modal');
  if (el) el.style.display = 'flex';
}

export function closeListingModal() {
  const el = document.getElementById('listing-modal');
  if (el) el.style.display = 'none';
  _modal = { itemId: null, stage: 'selection', condition: '', ebayCategory: '', generatedListing: null };
}

// ── Stage management ──────────────────────────────────────────────────────

function _showSelectionStage() {
  const item = getItems().find(i => i.id === _modal.itemId);
  if (!item) return;

  const nickEl = document.getElementById('listing-item-nickname');
  if (nickEl) nickEl.textContent = item.nickname;

  const condEl = document.getElementById('listing-condition-select');
  if (condEl) condEl.value = _modal.condition;

  const catSel  = document.getElementById('listing-ebay-category');
  const autoCat = CAT_DEFAULTS[item.category] || '293';
  if (catSel && autoCat) catSel.value = autoCat;

  _toggle('listing-selection-stage',  true);
  _toggle('listing-preview-stage',    false);
  _toggle('listing-selection-buttons', true);
  _toggle('listing-preview-buttons',  false);
}

export async function proceedToPreview() {
  const condEl = document.getElementById('listing-condition-select');
  const catEl  = document.getElementById('listing-ebay-category');
  if (!condEl?.value || !catEl?.value) { showToast('Select both condition and category'); return; }
  _modal.condition    = condEl.value;
  _modal.ebayCategory = catEl.value;
  await _generateAndShowPreview();
}

export async function regenerateListing() {
  await _generateAndShowPreview();
}

async function _generateAndShowPreview() {
  const item = getItems().find(i => i.id === _modal.itemId);
  if (!item) return;

  _toggle('listing-preview-stage',     true);
  _toggle('listing-selection-stage',   false);
  _toggle('listing-loading',           true);
  _toggle('listing-preview-content',   false);
  _toggle('listing-preview-error',     false);
  _toggle('listing-preview-buttons',   false);

  try {
    const listing = await generateListingWithAI(item, _modal.condition);
    _modal.generatedListing = listing;

    _setText('listing-title-display', listing.title);
    _setText('listing-title-length',  listing.title.length + '/80');
    _setText('listing-desc-display',  listing.description);
    _setText('listing-desc-length',   listing.description.length + '/1500');
    _setText('listing-cond-display',  listing.conditionNote);
    _setText('listing-cond-length',   listing.conditionNote.length + '/500');

    _toggle('listing-loading',         false);
    _toggle('listing-preview-content', true);
    _toggle('listing-preview-buttons', true);

    if (window.posthog) posthog.capture('listing_generated', { item_name: item.nickname });

  } catch (err) {
    _toggle('listing-loading',        false);
    _toggle('listing-preview-buttons', true);
    const errEl = document.getElementById('listing-preview-error');
    if (errEl) { errEl.textContent = 'Error: ' + (err.message || 'Failed to generate'); errEl.style.display = 'block'; }
  }
}

// ── Save listing ──────────────────────────────────────────────────────────

export async function saveListing(exportCsv = false) {
  const item = getItems().find(i => i.id === _modal.itemId);
  if (!item || !_modal.generatedListing) return;

  const updates = {
    ebayCatId: _modal.ebayCategory,
    listing: {
      title:          _modal.generatedListing.title,
      description:    _modal.generatedListing.description,
      conditionNote:  _modal.generatedListing.conditionNote,
      ebayCategory:   _modal.ebayCategory,
      ebayConditionId: EBAY_CONDITION_IDS[_modal.condition],
      generatedAt:    new Date().toISOString(),
    },
    ...(exportCsv ? { status: 'Ready to Export' } : {}),
  };

  updateItem(item.id, updates);
  showToast(exportCsv ? 'Listing saved & queued for export' : 'Listing saved to item');
  closeListingModal();
  window.App?.inventory?.render?.();
}

// ── AI listing generation ─────────────────────────────────────────────────

const _CAT_DESCRIPTORS = {
  'Electronics':      'functional, tested, specifications',
  'Clothing':         'fabric, fit, brand, styling',
  'Shoes':            'size, brand, condition, fit',
  'Home & Garden':    'materials, dimensions, functionality',
  'Collectibles':     'authenticity, rarity, condition',
  'Toys & Hobbies':   'completeness, vintage value, condition',
  'Books':            'author, edition, binding, condition',
  'Sporting Goods':   'brand, specifications, condition',
  'Jewelry & Watches': 'material, brand, specifications',
};

/**
 * Call Claude to generate an eBay listing for the given item.
 * @param {object} item
 * @param {string} condition
 * @returns {{ title: string, description: string, conditionNote: string }}
 */
export async function generateListingWithAI(item, condition) {
  const hint   = _CAT_DESCRIPTORS[item.category] || 'condition, functionality, quality';
  const prompt = `You are an expert eBay reseller writing product listings. Generate a title, description, and condition note for this item.

Item name: ${item.nickname}
Category: ${item.category}
Condition: ${condition}
Seller notes: ${item.notes || 'No additional notes'}

Focus on: ${hint}

STRICT REQUIREMENTS:
- Title: max 80 characters, eBay-optimized keywords first
- Description: 250-400 words, bullet points for key details, mobile-friendly
- Condition Note: 50-100 words, specific about condition

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "title": "...",
  "description": "...",
  "conditionNote": "..."
}`;

  const raw = await scanWithText('Generate eBay listing', prompt, 1000);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid response format from AI');
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    title:         (parsed.title         || '').substring(0, 80),
    description:   (parsed.description   || '').substring(0, 1500),
    conditionNote: (parsed.conditionNote || '').substring(0, 500),
  };
}

// ── Legacy CSV export (Ready to Export items) ─────────────────────────────

/**
 * Export all "Ready to Export" items that have a generated listing as an eBay CSV.
 * Updates their status to Listed after export.
 * (New per-item queue CSV is in ui/csv/CsvPanel.js)
 */
export function exportListingsToCSV() {
  const readyItems = getItems().filter(i => i.status === 'Ready to Export' && i.listing);
  if (!readyItems.length) { showToast('No listings ready for export'); return; }

  const header = [
    '#INFO,Version=0.0.2,Template= eBay-draft-listings-template_US,,,,,,,,',
    '"#INFO Action and Category ID are required fields.",,,,,,,,,',
    '"#INFO After upload, complete drafts at https://www.ebay.com/sh/lst/drafts",,,,,,,,,',
    '#INFO,,,,,,,,,,',
    'Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8),Custom label (SKU),Category ID,Title,UPC,Price,Quantity,Item photo URL,Condition ID,Description,Format',
  ];

  const rows = readyItems.map(item => {
    const listing  = item.listing;
    const catId    = EBAY_CONDITION_IDS[item.category] || '293';
    const desc     = '<p>' + listing.description.replace(/\n/g, '</p><p>') + '</p>';
    const row      = [
      'Draft', item.sku || '', catId, listing.title, '',
      item.sellPrice || '0', '1', '',
      listing.ebayConditionId || 'USED', desc, 'FixedPrice',
    ];
    return row.map(cell => {
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
        return '"' + cell.replace(/"/g, '""') + '"';
      }
      return cell;
    }).join(',');
  });

  const csv  = [...header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `eBay-listings-${new Date().toISOString().slice(0, 10)}.csv`;
  a.style.visibility = 'hidden';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  readyItems.forEach(item => updateItem(item.id, { status: 'Listed' }));
  showToast(`Exported ${readyItems.length} listings`);
  window.App?.inventory?.render?.();
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _toggle(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? 'block' : 'none';
}

function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
