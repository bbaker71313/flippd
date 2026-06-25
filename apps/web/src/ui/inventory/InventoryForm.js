/**
 * Inventory add/edit form — UI controller.
 *
 * Manages form state (editing id, in-form photo), reads DOM inputs,
 * delegates all persistence to features/inventory.js.
 */

import { getItems }               from '../../state/ItemsSlice.js';
import { getSettings }            from '../../state/SettingsSlice.js';
import { calcProfit }             from '../../core/profit.js';
import { CATEGORIES, migrateCategory } from '../../core/categories.js';
import { nextSKU }                from '../../core/sku.js';
import { findDuplicate }          from '../../core/validators.js';
import { savePhotos, loadPhotos } from '../../services/storage/idb.js';
import { saveNewItem, editItem }  from '../../features/inventory.js';
import { showToast }              from '../components/Toast.js';
import { showInvView }            from '../../router/tabs.js';
import { html, mount, trust, esc, escUrl } from '../util/esc.js';

// ── Module-local state ────────────────────────────────────────────────────

/** @type {number|null} — id of item being edited, null = new item */
let _editingId   = null;
/** @type {string|null} — filter to restore after save */
let _lastFilter  = null;
/** @type {string|null} — base64 photo taken in-form */
let _imgB64      = null;
let _imgType     = 'image/jpeg';
/** @type {Array<{src:string,source:'url'|'local',idx?:number}>} — photo list for edit gallery */
let _galleryPhotos = [];

export function getEditingId()  { return _editingId; }
export function getFormImg()    { return { b64: _imgB64, type: _imgType }; }
export function setFormImg(b64, type) { _imgB64 = b64; _imgType = type || 'image/jpeg'; }
export function clearFormImg()  { _imgB64 = null; }

// ── Form population ───────────────────────────────────────────────────────

/** Populate category/condition/status/platform <select> elements. */
export function initFormSelects() {
  const catEl = document.getElementById('f-category');
  if (catEl && !catEl.children.length) {
    catEl.innerHTML = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
  }
}

/** Open form to add a new item, optionally pre-filled from scan data. */
export function openAddForm(prefill = {}) {
  _editingId = null;
  _imgB64 = null;
  document.getElementById('inv-form-photo-preview')?.setAttribute('style', 'display:none');
  document.getElementById('inv-form-detect-btn')?.setAttribute('style', 'display:none');
  const detectStatus = document.getElementById('inv-form-detect-status');
  if (detectStatus) detectStatus.textContent = '';

  initFormSelects();

  _setField('form-title',   'Add New Item', true);
  _setField('f-nickname',   prefill.name     || '');
  _setField('f-category',   prefill.category || CATEGORIES[0]);
  _setField('f-condition',  prefill.condition || 'Good');
  _setField('f-date',       new Date().toISOString().split('T')[0]);
  _setField('f-platform',   'eBay');
  _setField('f-cost',       prefill.cost   || '');
  _setField('f-price',      prefill.price  || '');
  _setField('f-status',     'Unlisted');
  _setField('f-notes',      prefill.notes  || '');

  updateProfitPreview();
  showInvView('add');
}

/** Open form to edit an existing item by id. */
export function startEdit(id, lastFilter = null) {
  const item = getItems().find(i => i.id === id);
  if (!item) { showToast('Item not found. Please refresh'); return; }

  _lastFilter = lastFilter;
  _editingId  = id;
  _imgB64     = null;

  initFormSelects();

  // Reset all fields first to prevent data bleeding between items
  ['f-nickname', 'f-sku', 'f-cost', 'f-price', 'f-notes'].forEach(fid => {
    const el = document.getElementById(fid);
    if (el) el.value = '';
  });

  _setField('form-title',  'Edit Item', true);
  _setField('f-nickname',  item.nickname     || '');
  _setField('f-category',  item.category     || CATEGORIES[0]);
  _setField('f-condition', item.condition    || 'Good');
  _setField('f-date',      item.dateAcquired || new Date().toISOString().split('T')[0]);
  _setField('f-platform',  item.platform     || 'eBay');
  _setField('f-cost',      item.cost         || '');
  _setField('f-price',     item.sellPrice    || '');
  _setField('f-status',    item.status       || 'Unlisted');
  _setField('f-notes',     item.notes        || '');

  document.getElementById('inv-form-photo-preview')?.setAttribute('style', 'display:none');
  document.getElementById('inv-form-detect-btn')?.setAttribute('style', 'display:none');
  const detectStatus = document.getElementById('inv-form-detect-status');
  if (detectStatus) detectStatus.textContent = '';

  renderPhotoGallery(item);
  updateProfitPreview();
  showInvView('add');
  window.scrollTo(0, 0);
}

/** Live profit preview while user types cost/price. */
export function updateProfitPreview() {
  const cost  = document.getElementById('f-cost')?.value;
  const price = document.getElementById('f-price')?.value;
  const row   = document.getElementById('profit-preview-row');
  const val   = document.getElementById('profit-preview-val');
  if (!row || !val) return;

  if (cost && price) {
    const S = getSettings();
    const p = calcProfit(parseFloat(cost), parseFloat(price), S);
    val.textContent = '$' + p.toFixed(2);
    val.className   = p >= (S.minProfit || 15) ? 'u-pos' : 'u-neg';
    row.style.display = 'block';
  } else {
    row.style.display = 'none';
  }
}

/** Save the form — creates new item or updates existing. */
export async function saveInvItem() {
  const name = document.getElementById('f-nickname')?.value.trim();
  if (!name) { showToast('Item name is required'); return; }

  if (_editingId) {
    // Edit path — merge new photo if taken
    const existing   = getItems().find(i => i.id === _editingId);
    const newPhoto   = _imgB64 ? [`data:${_imgType};base64,${_imgB64}`] : [];
    const mergedPhotos = [...(existing?.photos || []), ...newPhoto].slice(0, 12);

    await editItem(_editingId, {
      nickname:     name,
      title:        name,
      category:     migrateCategory(document.getElementById('f-category')?.value || CATEGORIES[0]),
      condition:    document.getElementById('f-condition')?.value || 'Good',
      dateAcquired: document.getElementById('f-date')?.value || '',
      platform:     document.getElementById('f-platform')?.value || 'eBay',
      cost:         document.getElementById('f-cost')?.value || '0',
      sellPrice:    document.getElementById('f-price')?.value || '0',
      status:       document.getElementById('f-status')?.value || 'Unlisted',
      notes:        document.getElementById('f-notes')?.value || '',
      photos:       mergedPhotos,
      image_url:    mergedPhotos[0] || null,
    });

    _imgB64 = null;
    showToast('Item updated');

  } else {
    // New item path — duplicate check
    const dup = findDuplicate({ nickname: name }, getItems());
    if (dup) {
      const proceed = confirm(`"${dup.nickname}" already exists (${dup.status}).\n\nAdd it again anyway?`);
      if (!proceed) return;
    }

    const formPhoto = _imgB64 ? [`data:${_imgType};base64,${_imgB64}`] : [];
    const newItem = await saveNewItem({
      nickname:     name,
      category:     document.getElementById('f-category')?.value || CATEGORIES[0],
      condition:    document.getElementById('f-condition')?.value || 'Good',
      dateAcquired: document.getElementById('f-date')?.value || '',
      platform:     document.getElementById('f-platform')?.value || 'eBay',
      cost:         document.getElementById('f-cost')?.value || '0',
      sellPrice:    document.getElementById('f-price')?.value || '0',
      status:       document.getElementById('f-status')?.value || 'Unlisted',
      notes:        document.getElementById('f-notes')?.value || '',
      photos:       formPhoto,
      image_url:    formPhoto[0] || null,
      created_from: _imgB64 ? 'manual_photo' : 'manual',
    });

    _imgB64 = null;
    showToast('Item added to inventory');

    // If photos are pending from the photo editor, save and open edit
    if (window._paPreloadPhotos?.length && newItem) {
      const pending = window._paPreloadPhotos.slice(0, 4);
      window._paPreloadPhotos = null;
      await savePhotos(newItem.id, pending);
      _editingId = null;
      window.App?.tabs?.switchTab('inventory');
      setTimeout(() => startEdit(newItem.id), 120);
      return;
    }
  }

  _editingId = null;
  if (_lastFilter && _lastFilter.type !== 'all') {
    window.App?.inventory?.setListFilter?.(_lastFilter);
  }
  _lastFilter = null;
  showInvView('list');
  window.App?.inventory?.renderList?.();
}

/** Cancel form, restore prior view. */
export function cancelInvForm() {
  _editingId = null;
  _imgB64    = null;
  showInvView(_lastFilter?.type === 'all' || !_lastFilter ? 'home' : 'list');
}

// ── Photo gallery (edit mode) ─────────────────────────────────────────────

/**
 * Render existing photos in the form edit-mode gallery strip.
 * @param {object} item
 */
export function renderPhotoGallery(item) {
  const el = document.getElementById('inv-form-edit-photos');
  if (!el) return;

  const urls        = (item.photo_urls || []).filter(Boolean);
  const localPhotos = (item.photos     || []).filter(Boolean);

  _galleryPhotos = [
    ...urls.map(src        => ({ src, source: 'url' })),
    ...localPhotos.map((src, idx) => ({ src, source: 'local', idx })),
  ];

  if (!_galleryPhotos.length) { el.style.display = 'none'; return; }

  el.style.display = 'block';

  mount(el, html`
    <div class="edit-photos-label">PHOTOS (${_galleryPhotos.length}). Tap × to remove</div>
    <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch">
      ${_galleryPhotos.map((photo, i) => html`
        <div style="position:relative;flex-shrink:0">
          <img src="${photo.src}" loading="lazy" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">
          <button onclick="${trust(`App.invForm.removePhotoAt(${item.id},${i})`)}" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.7);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;line-height:18px;text-align:center;cursor:pointer;padding:0">×</button>
        </div>`)}
    </div>`);
}

/**
 * Remove a photo at gallery index i from item. Called via App.invForm.removePhotoAt().
 * @param {number} itemId
 * @param {number} galleryIdx
 */
export function removePhotoAt(itemId, galleryIdx) {
  const photo = _galleryPhotos[galleryIdx];
  if (!photo) return;

  const items = getItems();
  const item  = items.find(i => i.id === itemId);
  if (!item) return;

  if (photo.source === 'url') {
    editItem(itemId, {
      photo_urls: (item.photo_urls || []).filter(u => u !== photo.src),
    });
  } else {
    const photos = [...(item.photos || [])];
    photos.splice(photo.idx, 1);
    editItem(itemId, { photos, image_url: photos[0] || null });
  }

  renderPhotoGallery(getItems().find(i => i.id === itemId) || { ...item, photos: [] });
  showToast('Photo removed');
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _setField(id, value, isText = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (isText) el.textContent = value;
  else        el.value       = value;
}
