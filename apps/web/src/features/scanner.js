/**
 * Scanner feature controller.
 * Coordinates state, scan service, and UI — nothing else should know about all three.
 */

import { getSettings }            from '../state/SettingsSlice.js';
import { addItem, getItems }       from '../state/ItemsSlice.js';
import { loadScanLog, saveScanLog } from '../services/storage/local.js';
import {
  scanWithPhoto,
  scanWithText,
  getSingleSysPrompt,
  getShelfSysPrompt,
  compressForUpload,
  stitchPhotos,
} from '../services/scan.service.js';
import { calcFinancials, calcMaxCost } from '../core/profit.js';
import { getDecision }                 from '../core/decision.js';
import { mapToInvCategory }            from '../core/categories.js';
import { nextSKU }                     from '../core/sku.js';
import { showSrcView }                 from '../router/tabs.js';
import { showToast }                   from '../ui/components/Toast.js';
import { renderSingle, renderShelf }   from '../ui/scanner/ScanResult.js';
import { renderScanHistory }           from '../ui/scanner/ScanHistory.js';

// ── Scan state (local to this feature) ───────────────────────────────────

/** @type {File|null} */
let _imgFile = null;

/** @type {File[]} */
let _scanFiles = [];

/** @type {'single'|'shelf'} */
let _mode = 'single';

// ── Exported API ──────────────────────────────────────────────────────────

/** @param {'single'|'shelf'} mode */
export function setMode(mode) { _mode = mode; }

/** @param {File|null} file */
export function setImageFile(file) { _imgFile = file; }

/** @param {File[]} files */
export function setScanFiles(files) { _scanFiles = files; }

export function clearScan() {
  _imgFile  = null;
  _scanFiles = [];
}

/**
 * Run a single-item analysis.
 * @param {{ text: string, cost: number }} input
 * @param {{ onProgress: (msg: string) => void, onError: (msg: string) => void }} hooks
 */
export async function analyze({ text, cost }, { onProgress, onError }) {
  const settings = getSettings();
  if (!text && !_imgFile) { onError('Take a photo or describe the item first.'); return; }

  try {
    onProgress('Identifying item...');
    let scanResult;

    if (_imgFile) {
      let file = _imgFile;
      if (_scanFiles.length > 1) {
        onProgress('Combining photos...');
        file = await stitchPhotos(_scanFiles);
      } else {
        file = await compressForUpload(file);
      }
      onProgress('Analyzing eBay market...');
      const hint = text
        ? `Carefully identify this item using all visible details, then analyze for eBay reselling. Extra context: "${text}"`
        : 'Carefully identify and analyze this specific item for eBay reselling. Study all visible details — brand, model, labels, features.';
      scanResult = await scanWithPhoto('single_scan', hint, file);

      // Server returns camelCase — normalise to snake_case for consistency
      scanResult = _normalisePhotoResult(scanResult);
    } else {
      onProgress('Asking Claude...');
      const msg = `Analyze this specific item for eBay reselling: "${text}". Research actual eBay sold prices for this exact item.`;
      scanResult = await scanWithText(getSingleSysPrompt(settings), msg);
    }

    onProgress('Calculating profit...');
    const useCost = cost > 0 ? cost : (scanResult.estimated_cost ?? 0);
    const fin = calcFinancials(useCost, scanResult.avg_sold_price ?? 0, settings);
    const dec = getDecision(
      { profit: fin.profit, roi: fin.roi, days: scanResult.avg_days_to_sell ?? 0,
        sellThrough: scanResult.sell_through_rate ?? 0,
        demandLevel: scanResult.demand_level, confidence: scanResult.confidence },
      settings,
    );

    _logScan(dec, fin.roi, cost, false);
    renderSingle({ item: scanResult, cost: useCost, fin, dec });
    renderScanHistory();
    showSrcView('results');
  } catch (e) {
    onError(e.message ?? 'Scan failed. Please try again.');
  }
}

/**
 * Run a shelf (multi-item) scan.
 * @param {string} hint
 * @param {{ onProgress: (msg: string) => void, onError: (msg: string) => void }} hooks
 */
export async function analyzeShelf(hint, { onProgress, onError }) {
  if (!_imgFile) { onError('Take a shelf photo first.'); return; }
  const settings = getSettings();

  try {
    onProgress('Scanning shelf...');
    let file = _imgFile;
    if (_scanFiles.length > 1) {
      file = await stitchPhotos(_scanFiles);
    } else {
      file = await compressForUpload(file);
    }

    const result = await scanWithPhoto('shelf_scan', hint ?? '', file);
    const items  = Array.isArray(result) ? result : result.items ?? [];

    _logScan('SHELF', 0, 0, false);
    renderShelf(items);
    showSrcView('shelf');
  } catch (e) {
    onError(e.message ?? 'Shelf scan failed. Please try again.');
  }
}

/**
 * Add a scanned item to inventory.
 * @param {{ item: object, cost: number, fin: object, dec: string }} scanData
 * @returns {object} the created inventory item
 */
export function addScannedItem(scanData) {
  const { item, cost } = scanData;
  const settings  = getSettings();
  const existing  = getItems();
  const category  = mapToInvCategory(item.category);
  const now       = new Date().toISOString();

  const newItem = {
    id:           Date.now(),
    sku:          nextSKU(category, existing),
    nickname:     item.item_name ?? 'Unnamed Item',
    category,
    condition:    'Good',
    dateAcquired: now.slice(0, 10),
    cost:         String(cost || 0),
    sellPrice:    String(item.avg_sold_price ?? 0),
    platform:     'eBay',
    status:       'Unlisted',
    notes:        (item.listing_tips ?? []).join(' | '),
    createdAt:    now,
    photos:       [],
  };

  addItem(newItem);
  showToast(`${newItem.nickname} added to inventory`);
  return newItem;
}

// ── Private helpers ────────────────────────────────────────────────────────

function _normalisePhotoResult(r) {
  return {
    item_name:         r.itemName ?? r.item_name,
    avg_sold_price:    r.estimatedSell ?? r.avg_sold_price,
    price_low:         r.priceLow ?? r.price_low,
    price_high:        r.priceHigh ?? r.price_high,
    sell_through_rate: r.sellThroughRate ?? r.sell_through_rate ?? 0,
    avg_days_to_sell:  r.avgDaysToSell ?? r.avg_days_to_sell,
    demand_level:      r.demandLevel ?? r.demand_level,
    confidence:        r.confidence,
    confidence_reason: r.reasoning ?? r.confidence_reason,
    search_keywords:   r.searchKeywords ?? r.search_keywords ?? [],
    listing_tips:      r.listingTips ?? r.listing_tips ?? [],
    risk_flags:        r.riskFlags ?? r.risk_flags ?? [],
    condition_notes:   r.conditionNotes ?? r.condition_notes ?? '',
    category:          r.category,
    brand:             r.brand ?? null,
    notes:             r.notes ?? '',
    estimated_cost:    r.estimatedCost ?? null,
  };
}

function _logScan(decision, roi, cost, bought) {
  const log = loadScanLog();
  log.unshift({
    ts:       Date.now(),
    decision,
    roi:      Math.round(roi),
    cost,
    bought,
  });
  saveScanLog(log.slice(0, 100)); // keep last 100
}
