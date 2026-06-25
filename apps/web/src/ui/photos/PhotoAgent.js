/**
 * Photo Agent — canvas-based photo editing UI for eBay listings.
 *
 * All image processing runs in-browser on <canvas>. No external dependencies.
 * paPhotoBoost() is a Hustle+ tier feature (auto-white-balance + sharpening).
 */

import { getItems }               from '../../state/ItemsSlice.js';
import { AppState }               from '../../state/AppState.js';
import { savePhotos, loadPhotos } from '../../services/storage/idb.js';
import { editItem }               from '../../features/inventory.js';
import { showToast }              from '../components/Toast.js';
import { html, mount, trust } from '../util/esc.js';

// ── Module-local state ────────────────────────────────────────────────────

/** @type {Array<{original:string,w:number,h:number,enhanced:string|null,_isBlobUrl:boolean}>} */
let paPhotos     = [];
let paActiveIdx  = 0;
/** @type {number|null} — inventory item id being edited */
let paTargetItemId = null;
let _paCropState = null;
let _fsPinchDist = 0;
let _fsScale     = 1;

// ── One-time event wiring ─────────────────────────────────────────────────

/**
 * Wire delegated click listeners on the photo containers.
 * Call once after the Photos tab DOM is in the document.
 * Uses data-pa-idx / data-pa-del / data-pa-rm attributes so that
 * render functions never embed onclick attributes with dynamic content.
 */
export function initPhotoAgentListeners() {
  const thumbsEl = document.getElementById('pa-thumbs');
  if (thumbsEl) {
    thumbsEl.addEventListener('click', e => {
      const delBtn = e.target.closest('[data-pa-del]');
      const thumb  = e.target.closest('[data-pa-idx]');
      if (delBtn) {
        e.stopPropagation();
        paDeletePhoto(parseInt(delBtn.dataset.paDel, 10));
      } else if (thumb) {
        paSelectPhoto(parseInt(thumb.dataset.paIdx, 10));
      }
    });
  }

  const existingEl = document.getElementById('pa-existing-photos');
  if (existingEl) {
    existingEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-pa-rm]');
      if (btn) paRemoveExisting(parseInt(btn.dataset.paRm, 10));
    });
  }
}

// ── Dropdown population ───────────────────────────────────────────────────

export function populatePaDropdown() {
  const catSel = document.getElementById('pa-cat-select');
  if (!catSel) return;
  const activeCats = [...new Set(
    getItems().filter(i => i.status !== 'Sold').map(i => i.category)
  )].sort();
  mount(catSel, html`
    <option value="">Select category</option>
    ${activeCats.map(c => html`<option value="${c}">${c}</option>`)}`);
  const itemSel = document.getElementById('pa-inv-select');
  if (itemSel) {
    itemSel.style.display = 'none';
    mount(itemSel, html`<option value="">Select item</option>`);
  }
}

export function paFilterByCategory(cat) {
  const itemSel = document.getElementById('pa-inv-select');
  if (!cat) {
    if (itemSel) { itemSel.style.display = 'none'; mount(itemSel, html`<option value="">Select item</option>`); }
    return;
  }
  const filtered = getItems().filter(i => i.category === cat && i.status !== 'Sold');
  if (!itemSel) return;
  // Item IDs are numbers; nicknames/SKUs are user/AI text — use html`` to escape them.
  mount(itemSel, html`
    <option value="">Select item</option>
    ${filtered.map(i => html`<option value="${i.id}">${i.nickname} (${i.sku || 'no SKU'})</option>`)}`);
  itemSel.style.display = 'block';
  const epEl = document.getElementById('pa-existing-photos');
  if (epEl) epEl.textContent = '';
  paTargetItemId = null;
}

// ── Load / remove existing photos ─────────────────────────────────────────

export function paLoadItem(id) {
  const el = document.getElementById('pa-existing-photos');
  if (!id) { if (el) el.textContent = ''; paTargetItemId = null; return; }
  paTargetItemId = parseInt(id);
  const item = getItems().find(i => i.id == id);
  if (!el) return;
  if (item?.photos?.length) {
    // data-pa-rm carries the numeric index — the delegated listener in
    // initPhotoAgentListeners() reads it and calls paRemoveExisting(). No onclick attribute.
    mount(el, html`${item.photos.map((p, idx) => html`
      <div style="position:relative">
        <img src="${p}" style="width:52px;height:52px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">
        <button data-pa-rm="${idx}" style="position:absolute;top:1px;right:1px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:3px;font-size:9px;padding:1px 4px;cursor:pointer">×</button>
      </div>`)}`);
  } else {
    el.textContent = 'No photos yet';
  }
}

export function paRemoveExisting(idx) {
  if (!paTargetItemId) return;
  const item = getItems().find(i => i.id === paTargetItemId);
  if (!item) return;
  const photos = [...(item.photos || [])];
  photos.splice(idx, 1);
  editItem(paTargetItemId, { photos });
  paLoadItem(paTargetItemId);
}

// ── Photo intake ──────────────────────────────────────────────────────────

export function paHandlePhotos(e) {
  const files     = Array.from(e.target.files);
  const remaining = 4 - paPhotos.length;
  if (remaining <= 0) { showToast('Max 4 photos. Delete one to add another'); return; }
  const toProcess = files.slice(0, remaining);
  showToast(toProcess.length > 1 ? `Processing ${toProcess.length} photos...` : 'Processing photo...');

  (async () => {
    for (const file of toProcess) {
      try {
        const blobUrl = URL.createObjectURL(file);
        const dims = await new Promise(resolve => {
          const probe = new Image();
          probe.onload  = () => resolve({ w: probe.width, h: probe.height, ok: true });
          probe.onerror = () => resolve({ ok: false });
          probe.src = blobUrl;
        });
        if (!dims.ok) { URL.revokeObjectURL(blobUrl); showToast('Skipped one photo (could not load)'); continue; }

        const MAX = 1200;
        let { w, h } = dims;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }

        paPhotos.push({ original: blobUrl, w, h, enhanced: null, _isBlobUrl: true });
        if (paPhotos.length === 1) {
          document.getElementById('pa-upload-area')?.setAttribute('style', 'display:none');
          document.getElementById('pa-workspace')?.setAttribute('style', 'display:block');
        }
        paRenderThumbs();
        paSelectPhoto(paPhotos.length - 1);
        await new Promise(r => setTimeout(r, 50));
      } catch (err) {
        showToast('Skipped one photo: ' + (err.message || 'load failed'));
      }
    }
  })();
  e.target.value = '';
}

// ── Thumbnail strip ───────────────────────────────────────────────────────

export function paRenderThumbs() {
  const countEl = document.getElementById('pa-count-label');
  if (countEl) countEl.textContent = `${paPhotos.length} photo${paPhotos.length !== 1 ? 's' : ''}`;
  const thumbsEl = document.getElementById('pa-thumbs');
  if (!thumbsEl) return;
  // data-pa-idx / data-pa-del carry numeric indices only.
  // Clicks are handled by the delegated listener in initPhotoAgentListeners() — no onclick.
  mount(thumbsEl, html`${paPhotos.map((p, i) => html`
    <div class="pa-thumb${i === paActiveIdx ? ' active' : ''}" data-pa-idx="${i}" role="button" tabindex="0">
      <img src="${p.original}">
      <button class="pa-thumb-del" data-pa-del="${i}"></button>
    </div>`)}`);
}

export function paSelectPhoto(i) {
  paActiveIdx = i;
  paRenderThumbs();
  const p = paPhotos[i];
  const origEl = document.getElementById('pa-original');
  const canvas = document.getElementById('pa-canvas');
  if (origEl) origEl.src = p.original;
  if (canvas) { canvas.width = p.w; canvas.height = p.h; }
  paApplyFilters();
}

export function paDeletePhoto(i) {
  try {
    const p = paPhotos[i];
    if (p?._isBlobUrl && p.original?.startsWith('blob:')) URL.revokeObjectURL(p.original);
  } catch (_) {}
  paPhotos.splice(i, 1);
  if (!paPhotos.length) { paReset(); return; }
  paActiveIdx = Math.min(paActiveIdx, paPhotos.length - 1);
  paRenderThumbs();
  paSelectPhoto(paActiveIdx);
}

// ── Filter / canvas ops ───────────────────────────────────────────────────

export function paApplyFilters(onDone) {
  if (!paPhotos.length) { if (onDone) onDone(); return; }
  const canvas     = document.getElementById('pa-canvas');
  if (!canvas) return;
  const ctx        = canvas.getContext('2d');
  const brightness = parseInt(document.getElementById('pa-brightness')?.value ?? 15);
  const contrast   = parseInt(document.getElementById('pa-contrast')?.value ?? 20);
  const saturation = parseInt(document.getElementById('pa-saturation')?.value ?? 10);

  const bv = document.getElementById('pa-bright-val');
  const cv = document.getElementById('pa-contrast-val');
  const sv = document.getElementById('pa-sat-val');
  if (bv) bv.textContent = brightness;
  if (cv) cv.textContent = contrast;
  if (sv) sv.textContent = saturation;

  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d  = id.data;
    const cF = (contrast + 100) / 100;
    const sF = (saturation + 100) / 100;
    for (let k = 0; k < d.length; k += 4) {
      let r = d[k] + brightness, g = d[k+1] + brightness, b = d[k+2] + brightness;
      r = ((r/255 - 0.5) * cF + 0.5) * 255;
      g = ((g/255 - 0.5) * cF + 0.5) * 255;
      b = ((b/255 - 0.5) * cF + 0.5) * 255;
      const lum = 0.299*r + 0.587*g + 0.114*b;
      d[k]   = Math.max(0, Math.min(255, lum + (r - lum) * sF));
      d[k+1] = Math.max(0, Math.min(255, lum + (g - lum) * sF));
      d[k+2] = Math.max(0, Math.min(255, lum + (b - lum) * sF));
    }
    ctx.putImageData(id, 0, 0);
    paPhotos[paActiveIdx].enhanced = canvas.toDataURL('image/jpeg', 0.92);
    if (onDone) onDone();
  };
  img.src = paPhotos[paActiveIdx].original;
}

export function paApplyToAll() {
  const origIdx = paActiveIdx;
  const applyOne = i => new Promise(res => {
    paActiveIdx = i;
    const p = paPhotos[i];
    const canvas = document.getElementById('pa-canvas');
    if (canvas) { canvas.width = p.w; canvas.height = p.h; }
    paApplyFilters(res);
  });
  return paPhotos.reduce((chain, _, i) => chain.then(() => applyOne(i)), Promise.resolve())
    .then(() => { paActiveIdx = origIdx; paSelectPhoto(origIdx); });
}

export async function paDownloadAll() {
  if (!paPhotos.length) { showToast('No photos to download'); return; }
  if (document.getElementById('pa-apply-all')?.checked) await paApplyToAll();
  paPhotos.forEach((p, i) => {
    const a = document.createElement('a');
    a.download = `ebay-photo-${i+1}-${Date.now()}.jpg`;
    a.href = p.enhanced || p.original;
    a.click();
  });
  showToast(`${paPhotos.length} photo${paPhotos.length !== 1 ? 's' : ''} downloaded`);
}

export async function paSaveToItem() {
  if (!paTargetItemId) { paShowSaveDialog(); return; }
  if (document.getElementById('pa-apply-all')?.checked) await paApplyToAll();
  const saved    = paPhotos.map(p => p.enhanced || p.original);
  const existing = await loadPhotos(paTargetItemId);
  const combined = [...existing, ...saved].slice(0, 4);
  await savePhotos(paTargetItemId, combined);
  editItem(paTargetItemId, { photos: combined });
  showToast(`${saved.length} photo${saved.length !== 1 ? 's' : ''} saved to item`);
  const targetId = paTargetItemId;
  paReset();
  window.App?.tabs?.switchTab('inventory');
  setTimeout(() => window.App?.invForm?.startEdit(targetId), 120);
}

export function paReset() {
  paPhotos.forEach(p => {
    try { if (p?._isBlobUrl && p.original?.startsWith('blob:')) URL.revokeObjectURL(p.original); } catch (_) {}
  });
  paPhotos = []; paActiveIdx = 0;
  document.getElementById('pa-upload-area')?.setAttribute('style', 'display:block');
  document.getElementById('pa-workspace')?.setAttribute('style', 'display:none');
  const bEl = document.getElementById('pa-brightness'); if (bEl) bEl.value = 15;
  const cEl = document.getElementById('pa-contrast');   if (cEl) cEl.value = 20;
  const sEl = document.getElementById('pa-saturation'); if (sEl) sEl.value = 10;
  const aEl = document.getElementById('pa-apply-all');  if (aEl) aEl.checked = false;
}

// ── Rotate / crop ─────────────────────────────────────────────────────────

export function paRotate(deg) {
  if (!paPhotos.length) return;
  const canvas = document.getElementById('pa-canvas');
  const ctx    = canvas.getContext('2d');
  const src    = paPhotos[paActiveIdx].enhanced || canvas.toDataURL('image/jpeg', 0.92);
  const img    = new Image();
  img.onload = () => {
    const w = canvas.width, h = canvas.height;
    canvas.width = h; canvas.height = w;
    paPhotos[paActiveIdx].w = h; paPhotos[paActiveIdx].h = w;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(deg * Math.PI / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    const result = canvas.toDataURL('image/jpeg', 0.92);
    paPhotos[paActiveIdx].enhanced = result;
    paPhotos[paActiveIdx].original = result;
    paPhotos[paActiveIdx]._isBlobUrl = false;
  };
  img.src = src;
}

export function paCropSquare() {
  if (!paPhotos.length) return;
  const canvas = document.getElementById('pa-canvas');
  const ctx    = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const size = Math.min(w, h);
  const sx = Math.floor((w - size) / 2), sy = Math.floor((h - size) / 2);
  const id = ctx.getImageData(sx, sy, size, size);
  canvas.width = size; canvas.height = size;
  ctx.putImageData(id, 0, 0);
  paPhotos[paActiveIdx].w = size; paPhotos[paActiveIdx].h = size;
  const result = canvas.toDataURL('image/jpeg', 0.92);
  paPhotos[paActiveIdx].enhanced = result;
  paPhotos[paActiveIdx].original = result;
  paPhotos[paActiveIdx]._isBlobUrl = false;
}

export function paStartCrop() {
  const canvas  = document.getElementById('pa-canvas');
  if (!canvas || !paPhotos.length) return;
  const overlay  = document.getElementById('pa-crop-overlay');
  const controls = document.getElementById('pa-crop-controls');
  if (!overlay) return;
  overlay.style.display = 'block';
  if (controls) controls.style.display = 'flex';
  _paCropState = { startX: 0, startY: 0, endX: 0, endY: 0, dragging: false };

  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;

  function getPos(e) {
    const t = e.touches ? e.touches[0] : e;
    return {
      x: Math.max(0, Math.min(rect.width,  t.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, t.clientY - rect.top)),
    };
  }
  function onStart(e) {
    e.preventDefault();
    const p = getPos(e);
    _paCropState = { startX: p.x, startY: p.y, endX: p.x, endY: p.y, dragging: true, scaleX, scaleY, rect };
    _updateCropRect();
  }
  function onMove(e) {
    if (!_paCropState?.dragging) return;
    e.preventDefault();
    const p = getPos(e);
    _paCropState.endX = p.x; _paCropState.endY = p.y;
    _updateCropRect();
  }
  function onEnd() { if (_paCropState) _paCropState.dragging = false; }

  overlay._onStart = onStart; overlay._onMove = onMove; overlay._onEnd = onEnd;
  overlay.addEventListener('mousedown',  onStart);
  overlay.addEventListener('mousemove',  onMove);
  overlay.addEventListener('mouseup',    onEnd);
  overlay.addEventListener('touchstart', onStart, { passive: false });
  overlay.addEventListener('touchmove',  onMove,  { passive: false });
  overlay.addEventListener('touchend',   onEnd);
}

function _updateCropRect() {
  const r = document.getElementById('pa-crop-rect');
  if (!r || !_paCropState) return;
  const { startX, startY, endX, endY } = _paCropState;
  const x = Math.min(startX, endX), y = Math.min(startY, endY);
  const w = Math.abs(endX - startX),  h = Math.abs(endY - startY);
  r.style.display = w > 2 && h > 2 ? 'block' : 'none';
  r.style.left = `${x}px`; r.style.top = `${y}px`;
  r.style.width = `${w}px`; r.style.height = `${h}px`;
}

export function paApplyCrop() {
  if (!_paCropState) return;
  const canvas = document.getElementById('pa-canvas');
  const { startX, startY, endX, endY, scaleX, scaleY } = _paCropState;
  const x = Math.round(Math.min(startX, endX) * scaleX);
  const y = Math.round(Math.min(startY, endY) * scaleY);
  const w = Math.round(Math.abs(endX - startX) * scaleX);
  const h = Math.round(Math.abs(endY - startY) * scaleY);
  if (w < 10 || h < 10) { showToast('Select a larger area to crop'); return; }
  const ctx = canvas.getContext('2d');
  const id  = ctx.getImageData(x, y, w, h);
  canvas.width = w; canvas.height = h;
  ctx.putImageData(id, 0, 0);
  paPhotos[paActiveIdx].w = w; paPhotos[paActiveIdx].h = h;
  const result = canvas.toDataURL('image/jpeg', 0.92);
  paPhotos[paActiveIdx].enhanced = result;
  paPhotos[paActiveIdx].original = result;
  paPhotos[paActiveIdx]._isBlobUrl = false;
  paCancelCrop();
  showToast('Crop applied');
}

export function paCancelCrop() {
  const overlay  = document.getElementById('pa-crop-overlay');
  const controls = document.getElementById('pa-crop-controls');
  if (overlay) {
    overlay.style.display = 'none';
    if (overlay._onStart) {
      overlay.removeEventListener('mousedown',  overlay._onStart);
      overlay.removeEventListener('mousemove',  overlay._onMove);
      overlay.removeEventListener('mouseup',    overlay._onEnd);
      overlay.removeEventListener('touchstart', overlay._onStart);
      overlay.removeEventListener('touchmove',  overlay._onMove);
      overlay.removeEventListener('touchend',   overlay._onEnd);
    }
  }
  if (controls) controls.style.display = 'none';
  const r = document.getElementById('pa-crop-rect');
  if (r) r.style.display = 'none';
  _paCropState = null;
}

// ── Photo Boost (Hustle+ feature) ─────────────────────────────────────────

export function paPhotoBoost() {
  const user = AppState.currentUser;
  const tier = user?.tier || 'scout';
  const trialActive = user?.trialEndsAt && new Date(user.trialEndsAt) > new Date();
  if (tier === 'scout' && !trialActive) {
    showToast('Photo Boost is a Hustle+ feature');
    window.App?.tabs?.switchTab('dashboard');
    return;
  }
  if (!paPhotos.length) return;

  const canvas = document.getElementById('pa-canvas');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const src = ctx.getImageData(0, 0, W, H);
  const d   = src.data;

  // Auto white balance — average of lightest 5% of pixels
  const samples = [];
  for (let k = 0; k < d.length; k += 4) {
    const lum = 0.299 * d[k] + 0.587 * d[k+1] + 0.114 * d[k+2];
    samples.push({ lum, r: d[k], g: d[k+1], b: d[k+2] });
  }
  samples.sort((a, b) => b.lum - a.lum);
  const topN = Math.max(1, Math.floor(samples.length * 0.05));
  const top  = samples.slice(0, topN);
  const avgR = top.reduce((s, p) => s + p.r, 0) / topN;
  const avgG = top.reduce((s, p) => s + p.g, 0) / topN;
  const avgB = top.reduce((s, p) => s + p.b, 0) / topN;
  const wbR  = avgR > 0 ? 255 / avgR : 1;
  const wbG  = avgG > 0 ? 255 / avgG : 1;
  const wbB  = avgB > 0 ? 255 / avgB : 1;

  for (let k = 0; k < d.length; k += 4) {
    let r = Math.min(255, d[k]   * wbR);
    let g = Math.min(255, d[k+1] * wbG);
    let b = Math.min(255, d[k+2] * wbB);
    r = 128 + (r - 128) * 1.1;
    g = 128 + (g - 128) * 1.1;
    b = 128 + (b - 128) * 1.1;
    d[k]   = Math.max(0, Math.min(255, r));
    d[k+1] = Math.max(0, Math.min(255, g));
    d[k+2] = Math.max(0, Math.min(255, b));
  }
  ctx.putImageData(src, 0, 0);

  // Sharpen (gentle 3×3 kernel)
  const s2  = ctx.getImageData(0, 0, W, H);
  const dst = ctx.createImageData(W, H);
  const kern = [0, -0.5, 0, -0.5, 3, -0.5, 0, -0.5, 0];
  const d2 = s2.data, dd = dst.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let ky = 0; ky < 3; ky++) {
        for (let kx = 0; kx < 3; kx++) {
          const px  = Math.min(W-1, Math.max(0, x + kx - 1));
          const py  = Math.min(H-1, Math.max(0, y + ky - 1));
          const idx = (py * W + px) * 4;
          const kv  = kern[ky * 3 + kx];
          r += d2[idx] * kv; g += d2[idx+1] * kv; b += d2[idx+2] * kv;
        }
      }
      const i = (y * W + x) * 4;
      dd[i]   = Math.max(0, Math.min(255, r));
      dd[i+1] = Math.max(0, Math.min(255, g));
      dd[i+2] = Math.max(0, Math.min(255, b));
      dd[i+3] = d2[i+3];
    }
  }
  ctx.putImageData(dst, 0, 0);
  paPhotos[paActiveIdx].enhanced = canvas.toDataURL('image/jpeg', 0.95);
  showToast('Photo Boost applied — white balance, contrast, and sharpness enhanced');
}

// ── Remove BG (remove.bg API key from settings) ───────────────────────────

export async function paRemoveBg(removebgKey) {
  if (!removebgKey) { showToast('Add your remove.bg API key in Settings to enable this'); return; }
  if (!paPhotos.length) { showToast('No photo loaded'); return; }
  const btn = document.getElementById('pa-removebg-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Removing...'; }
  try {
    const canvas = document.getElementById('pa-canvas');
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
    const fd   = new FormData();
    fd.append('image_file', blob, 'photo.jpg');
    fd.append('size', 'auto');
    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST', headers: { 'X-Api-Key': removebgKey }, body: fd,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.errors?.[0]?.title || 'API error ' + res.status);
    }
    const buf    = await res.arrayBuffer();
    const blobUrl = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
    const img2   = new Image();
    img2.onload = () => {
      const ctx2 = canvas.getContext('2d');
      ctx2.fillStyle = '#ffffff';
      ctx2.fillRect(0, 0, canvas.width, canvas.height);
      ctx2.drawImage(img2, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(blobUrl);
      const result = canvas.toDataURL('image/jpeg', 0.92);
      paPhotos[paActiveIdx].enhanced = result;
      paPhotos[paActiveIdx].original = result;
      paPhotos[paActiveIdx]._isBlobUrl = false;
      showToast('Background removed');
    };
    img2.src = blobUrl;
  } catch (e) {
    showToast('Remove BG failed: ' + (e.message || 'unknown error'));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Remove BG'; }
  }
}

// ── Fullscreen preview ────────────────────────────────────────────────────

export function paOpenFullscreen() {
  if (!paPhotos.length) return;
  const canvas  = document.getElementById('pa-canvas');
  const overlay = document.getElementById('pa-fs-overlay');
  const img     = document.getElementById('pa-fs-img');
  if (!overlay || !img) return;
  img.src = paPhotos[paActiveIdx].enhanced || canvas.toDataURL('image/jpeg', 0.92);
  _fsScale = 1;
  img.style.transform      = 'scale(1)';
  img.style.transformOrigin = '50% 50%';
  overlay.style.display = 'flex';
  img._fsWheel      = e => { e.preventDefault(); _fsScale = Math.max(0.5, Math.min(8, _fsScale - e.deltaY * 0.001)); img.style.transform = `scale(${_fsScale})`; };
  img._fsTouchStart = e => { if (e.touches.length === 2) _fsPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); };
  img._fsTouchMove  = e => { if (e.touches.length === 2) { e.preventDefault(); const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); _fsScale = Math.max(0.5, Math.min(8, _fsScale * (d / _fsPinchDist))); img.style.transform = `scale(${_fsScale})`; _fsPinchDist = d; } };
  img.addEventListener('wheel',      img._fsWheel,      { passive: false });
  img.addEventListener('touchstart', img._fsTouchStart, { passive: true  });
  img.addEventListener('touchmove',  img._fsTouchMove,  { passive: false });
}

export function paCloseFullscreen(e) {
  const overlay = document.getElementById('pa-fs-overlay');
  const img     = document.getElementById('pa-fs-img');
  if (e && e.target === img) return;
  if (img) {
    img.removeEventListener('wheel',      img._fsWheel);
    img.removeEventListener('touchstart', img._fsTouchStart);
    img.removeEventListener('touchmove',  img._fsTouchMove);
  }
  if (overlay) overlay.style.display = 'none';
}

// ── Save dialog ───────────────────────────────────────────────────────────

export function paShowSaveDialog() {
  if (document.getElementById('pa-save-dialog')) return;
  const overlay = document.createElement('div');
  overlay.id = 'pa-save-dialog';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:9050;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
  mount(overlay, trust(
    '<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:320px;width:100%;box-sizing:border-box">' +
      '<div style="font-family:\'Syne\',sans-serif;font-size:17px;font-weight:900;color:var(--text);margin-bottom:6px">Save Photos To</div>' +
      '<div style="font-size:12px;color:var(--muted);margin-bottom:18px">Select where to attach these enhanced photos</div>' +
      '<button onclick="App.photos.saveDialogNewItem()" style="width:100%;padding:12px;background:var(--green);color:#000;border:none;border-radius:8px;font-family:\'Syne\',sans-serif;font-size:13px;font-weight:800;cursor:pointer;margin-bottom:8px">+ New Inventory Item</button>' +
      '<button onclick="App.photos.saveDialogExisting()" style="width:100%;padding:12px;background:var(--card);color:var(--text);border:1.5px solid var(--border);border-radius:8px;font-family:\'Syne\',sans-serif;font-size:13px;font-weight:800;cursor:pointer;margin-bottom:14px">Existing Item</button>' +
      '<button onclick="document.getElementById(\'pa-save-dialog\').remove()" style="width:100%;padding:8px;background:none;color:var(--muted);border:none;font-family:\'IBM Plex Mono\',monospace;font-size:12px;cursor:pointer">Cancel</button>' +
    '</div>'
  ));
  document.body.appendChild(overlay);
}

export function paSaveDialogNewItem() {
  document.getElementById('pa-save-dialog')?.remove();
  window._paPreloadPhotos = paPhotos.map(p => p.enhanced || p.original);
  window.App?.tabs?.switchTab('inventory');
  setTimeout(() => window.App?.invForm?.openAddForm(), 120);
}

export function paSaveDialogExisting() {
  document.getElementById('pa-save-dialog')?.remove();
  window.scrollTo(0, 0);
  const catSel = document.getElementById('pa-cat-select');
  if (catSel) { catSel.focus(); showToast('Select a category and item above, then tap Save'); }
}
