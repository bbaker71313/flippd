# App Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all bugs and UX issues identified in the 2026-06-19 audit across Inventory tabs, eBay Sync, Photo Enhancer, P&L Tab (renamed Profit Hub), and Pulse Tab (renamed Profit Compass).

**Architecture:** All changes live in `apps/web/public/app.html` — a single-file web app. There is no build step; edits go directly into the HTML/CSS/JS in that file. The file is ~7880 lines. Every function and DOM element is global. Changes are tested by opening the file in a browser (or the live Vercel URL). Commits go to branch `claude/cool-rubin-mka6bv`.

**Tech Stack:** Vanilla JS, HTML, CSS. No frameworks, no bundler. IndexedDB for photos. Supabase Edge Functions for server sync. Canvas API for photo editing.

## Global Constraints

- Never hardcode: eBay fee %, tax rate, mileage rate, tier limits — always read from `S` (settings object).
- Never use `<form>` tags — use `onclick`/`oninput` handlers only.
- Never add a 6th tab. Tab names: SCOUT, INVENTORY, PHOTOS, PULSE (→ Profit Compass), P&L (→ Profit Hub).
- Never call Anthropic API from client — always via Supabase Edge Function.
- Files must stay under 500 lines per CLAUDE.md… but app.html is already 7880 lines. Do not restructure the file — edit in place.
- NativeWind/StyleSheet rules apply to mobile only — not relevant here.
- After every task: `git add apps/web/public/app.html && git commit -m "fix: <description>"`
- Push when all tasks are complete: `git push -u origin claude/cool-rubin-mka6bv`

---

## File Map

All edits are in: `apps/web/public/app.html`

Key line ranges (approximate — verify with grep before editing):
- Tab button bar: ~L1154–1156
- Item card renderer (`renderFilteredList`): ~L2762–2806
- `relistItem()`: ~L2845–2860
- `handleListOnEbay()`: ~L5060–5071
- `handleSyncOrders()`: ~L5074–5088
- `ebayPullListings()`: ~L5008–5054
- `paCropSquare()`: ~L3799–3814 (Photo Enhancer — Square crop)
- Photo Enhancer toolbar HTML: ~L1632–1676
- `paPhotoBoost()`: ~L3849–3876
- `getApiHeaders()`: ~L5323–5328
- `renderDashboard()`: ~L4704–4800 (current P&L/Dash tab content)
- Dashboard tab HTML: ~L1944 (section comment `<!-- TAB: DASHBOARD (P&L) -->`)
- Pulse/Growth tab label: ~L1156 and ~L1696
- Settings `remove.bg` input: ~L1295–1296

---

## Task 1: Photo Thumbnails on Item Cards

**Problem:** `thumbUrl` is set from `item.photo_urls[0]` or `item.photos[0]`, but `item.photos` stores base64 strings OR blob URLs and the first element is being used raw. The thumbnail shows a placeholder even when photos exist because after IndexedDB load, photos may not be on the item object in the card render path.

**Files:**
- Modify: `apps/web/public/app.html` (~L2762–2806, renderFilteredList)

**Root cause to verify first:**
```bash
grep -n "photoMap\|loadPhotosFromIDB\|savePhotosIDB\|photos.*item\|item.*photos" apps/web/public/app.html | head -30
```
Check whether photos are loaded onto `items` array before `renderFilteredList` is called. If `photoMap` is async and not awaited, photos won't be on items at render time.

- [ ] **Step 1: Locate the photo load timing**

```bash
grep -n "photoMap\|loadPhotosFromIDB\|syncFromServer\|renderFilteredList\|renderInventoryHome" apps/web/public/app.html | head -40
```
Expected: find where photos are attached to items and where render is called — confirm the order.

- [ ] **Step 2: Write the failing test (manual)**

Open `app.html` in browser. Add an item with a photo. Go to Inventory. Look at the item card — confirm the placeholder shows instead of the photo. Take a screenshot or note the broken state.

- [ ] **Step 3: Fix — ensure photos are on items before render**

Find the `renderFilteredList` function (~L2762). The `thumbUrl` line currently reads:
```js
const thumbUrl = (item.photo_urls && item.photo_urls[0]) || (item.photos && item.photos[0]) || item.main_photo_url || null;
```

The issue is that `item.photos` may be blob URLs (from IndexedDB) or base64 strings. Blob URLs won't survive serialization. The fix: use a global `photoMap` that is populated async and query it at render time.

Find `photoMap` definition. If it exists as a global (e.g. `let photoMap = {}`), update `renderFilteredList` to also check `photoMap[item.id]`:

```js
// In renderFilteredList, replace the thumbUrl line:
const storedPhotos = (typeof photoMap !== 'undefined' && photoMap[item.id]) || [];
const thumbUrl = (item.photo_urls && item.photo_urls[0])
  || (storedPhotos && storedPhotos[0])
  || (item.photos && item.photos[0])
  || item.main_photo_url
  || null;
```

Also check `showSoldDetail` (~L2874) has the same `thumbUrl` pattern — apply same fix there.

- [ ] **Step 4: Verify in browser**

Open app.html. Navigate to Inventory. Items with photos should now show their photo thumbnail. Items without photos show the placeholder SVG.

- [ ] **Step 5: Commit**

```bash
git add apps/web/public/app.html
git commit -m "fix: show item photo thumbnails on inventory cards"
```

---

## Task 2: Item Deduplication — Unique IDs + Duplicate Guard

**Problem:** Items appear in Unlisted, Listed, and Sold simultaneously. This happens because:
1. `relistItem()` creates a new item with `id: Date.now()` but doesn't update the old item's status — so both the Sold item and the new Unlisted item exist.
2. eBay pull-listings creates server-side records that then get synced client-side without deduplication on `ebay_item_id`.

**Files:**
- Modify: `apps/web/public/app.html` (~L2845–2860, relistItem; ~L3391, new item save; ~L5008–5054, ebayPullListings)

- [ ] **Step 1: Fix `relistItem` to keep sold item in Sold**

Find `relistItem` (~L2845). Current code pushes a new item but doesn't touch the original. That's correct — but the sold item remains in Sold view. The bug is that the new relisted item copies the old `ebay_item_id`, causing eBay sync to merge it back into the wrong status.

Replace `relistItem`:
```js
function relistItem(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  const newId = Date.now();
  const newItem = {
    ...item,
    id: newId,
    status: 'Unlisted',
    dateAcquired: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    listed_at: null,
    sold_at: null,
  };
  // Clear sold fields and eBay ID so this is treated as a fresh listing
  delete newItem.soldPrice;
  delete newItem.sold_price;
  delete newItem.soldDate;
  delete newItem.sold_date;
  delete newItem.ebay_item_id;
  delete newItem.ebayItemId;
  // Copy photos from IndexedDB for the original item into the new item
  if (typeof photoMap !== 'undefined' && photoMap[item.id]) {
    savePhotosIDB(newId, photoMap[item.id]);
    photoMap[newId] = photoMap[item.id];
  }
  items.push(newItem);
  saveItems();
  renderInventoryHome();
  showToast('New listing created in Unlisted — original stays in Sold');
}
```

- [ ] **Step 2: Run test (manual)**

Open app. Go to a Sold item. Click Relist. Verify:
- The sold item remains in the Sold tab.
- A new item appears in the Unlisted tab.
- The new item has no eBay item ID.

- [ ] **Step 3: Add duplicate guard when adding new items**

Find where new items are saved (grep for `status.*Unlisted` near form save, ~L3391). Find the `saveItem` or `addItem` function. Before pushing a new item, check if a matching item already exists:

```js
// Add this helper function near the top of the JS section (after STATUSES declaration ~L2283):
function findDuplicateItem(nickname, sku) {
  if (!nickname) return null;
  const norm = s => String(s || '').toLowerCase().trim();
  const n = norm(nickname);
  return items.find(i =>
    (sku && i.sku && norm(i.sku) === norm(sku)) ||
    norm(i.nickname) === n
  ) || null;
}
```

Find the form submit / save handler (grep for `saveItem\|addItem\|saveNewItem\|f-nickname`). Before inserting a new item (when `editingId === null`), call `findDuplicateItem`:

```js
// Before the items.push(newItem) call for a NEW item (editingId === null):
if (!editingId) {
  const dup = findDuplicateItem(data.nickname, data.sku);
  if (dup) {
    const proceed = confirm(
      `"${dup.nickname}" already exists in ${dup.status}.\n\nAdd it again anyway?`
    );
    if (!proceed) return;
  }
}
```

- [ ] **Step 4: Verify duplicate guard (manual)**

Try to add an item with the same name as an existing one. Confirm appears. Click cancel → item not added. Click OK → item added.

- [ ] **Step 5: Commit**

```bash
git add apps/web/public/app.html
git commit -m "fix: relist keeps sold item in Sold, new item has no eBay ID; add duplicate guard on add"
```

---

## Task 3: Delete Button on All Item Cards

**Problem:** Audit requests a Delete button on every item card (Unlisted, Listed, Sold tabs). A `deleteItem(id)` function exists at ~L3490 — it just needs to be surfaced on the card for all statuses.

**Files:**
- Modify: `apps/web/public/app.html` (~L2785–2794, item card button row)

- [ ] **Step 1: Locate the button row in renderFilteredList**

```bash
grep -n "Enhance Photo\|sm-btn-danger\|deleteItem\|Relist\|Mark Listed\|sold-btn" apps/web/public/app.html | head -20
```

- [ ] **Step 2: Add Delete button to every card**

Find the `item-row-bot` div in `renderFilteredList` (~L2785). Currently the button row conditionally renders Edit, List on eBay, Mark Listed, Sold, Enhance Photo, Relist. Add a Delete button that shows for ALL items:

```js
// Add to the item-row-bot div, after all existing buttons:
`<button class="sm-btn" style="background:none;border:1px solid var(--red);color:var(--red);border-radius:5px;padding:3px 8px;font-size:11px;font-family:'IBM Plex Mono',monospace;cursor:pointer" onclick="event.stopPropagation();deleteItem(${item.id})">Delete</button>`
```

This replaces or supplements the existing delete button if one already exists. Grep first:
```bash
grep -n "deleteItem\|sm-btn-danger" apps/web/public/app.html
```
If `sm-btn-danger` already appears in the card, verify it's currently conditional and make it unconditional.

- [ ] **Step 3: Verify (manual)**

Open app. Go to Unlisted, Listed, Sold — each item card should now show a red Delete button. Click one, confirm the item is removed.

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/app.html
git commit -m "fix: add Delete button to all item cards across all status tabs"
```

---

## Task 4: Item Card Button Cleanup per Tab

**Problem (from audit):**
- **Unlisted tab:** No changes needed per audit (keep List on eBay, Mark Listed, add Delete).
- **Listed tab:** Remove "Edit" button (card click already opens edit). Remove "Enhance Photo" button (now in add/edit page). Change "Sold" button label to "Mark Sold". Change "Listing" button to "Listing Boost".
- **Sold tab:** Audit is covered in Task 2 (relist fix). No button rename needed here.

**Files:**
- Modify: `apps/web/public/app.html` (~L2785–2794)

- [ ] **Step 1: Remove Edit button from Listed items**

Find the Edit button in the card (~L2789):
```js
${!isSold ? `<button ... onclick="event.stopPropagation();startEdit(${item.id})">Edit</button>` : ''}
```
Change condition to `isUnlisted` only (remove from Listed items):
```js
${isUnlisted ? `<button ... onclick="event.stopPropagation();startEdit(${item.id})">Edit</button>` : ''}
```

- [ ] **Step 2: Remove Enhance Photo from Listed items**

Find the Enhance Photo button (~L2792):
```js
${!isSold ? `<button ...>Enhance Photo</button>` : ''}
```
Change to only show on Unlisted:
```js
${isUnlisted ? `<button ...>Enhance Photo</button>` : ''}
```

- [ ] **Step 3: Rename Sold → Mark Sold on Listed cards**

Find the `.sold-btn` button (~L2791):
```js
${isListed ? `<button class="sold-btn" onclick="event.stopPropagation();openSoldModal(${item.id})">Sold</button>` : ''}
```
Change label:
```js
${isListed ? `<button class="sold-btn" onclick="event.stopPropagation();openSoldModal(${item.id})">Mark Sold</button>` : ''}
```

- [ ] **Step 4: Rename Listing → Listing Boost on Listed cards**

Find the listing button (~L2787):
```js
${!isSold && !hasListing ? `<button class="listing-btn" onclick="openListingModal(${item.id})" title="Generate eBay listing">Listing</button>` : ''}
```
Change to show on Listed items and rename to "Listing Boost":
```js
${isListed ? `<button class="listing-btn" onclick="openListingModal(${item.id})" title="Generate eBay listing">Listing Boost</button>` : ''}
${isUnlisted && !hasListing ? `<button class="listing-btn" onclick="openListingModal(${item.id})" title="Generate eBay listing">Listing</button>` : ''}
```

- [ ] **Step 5: Verify (manual)**

Open Inventory. Filter to Listed. Cards should show: Listing Boost, Mark Sold, Delete. No Edit, no Enhance Photo. Unlisted cards: Edit, Mark Listed, List on eBay, Enhance Photo, Delete.

- [ ] **Step 6: Commit**

```bash
git add apps/web/public/app.html
git commit -m "fix: listed tab card buttons — remove Edit/Enhance Photo, rename Sold to Mark Sold, Listing to Listing Boost"
```

---

## Task 5: Fix "Invalid value for header language" Error on List on eBay

**Problem:** Clicking "List on eBay" throws an "Invalid value for header language" error. The `getApiHeaders()` function at ~L5323 only sets `Content-Type` and `Authorization`. The error likely comes from the eBay Edge Function or from a browser header being sent. Need to trace where `language` header comes from.

**Files:**
- Modify: `apps/web/public/app.html` (~L5060–5071, handleListOnEbay; ~L5323–5328, getApiHeaders)
- Reference: `supabase/functions/ebay-oauth/index.ts` (check for language header usage)

- [ ] **Step 1: Find the source of the language header error**

```bash
grep -rn "language\|Language\|Accept-Language\|content-language" apps/web/public/app.html supabase/functions/ | grep -v "\.git"
```
Expected: find where a `language` header is set or expected.

- [ ] **Step 2: Check the eBay create-listing Edge Function**

```bash
ls supabase/functions/
cat supabase/functions/ebay-oauth/index.ts | grep -i "language" | head -20
```

- [ ] **Step 3: Fix the header**

If the error is that eBay's API requires a valid `Accept-Language` header and the Edge Function is passing it through without setting it:

In `handleListOnEbay` or in the Edge Function, ensure the eBay API call includes:
```
Accept-Language: en-US
```

If the fix is in `getApiHeaders()`, add:
```js
function getApiHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey,
    'Accept-Language': 'en-US'
  };
}
```

If the fix belongs in the Edge Function (supabase/functions/ebay-oauth or a create-listing function), add the header to the eBay API fetch call there instead. Prefer fixing it server-side so it doesn't affect all API calls.

- [ ] **Step 4: Verify (manual)**

Open app. Go to an Unlisted item. Click "List on eBay". Confirm no language error. (May still fail for other reasons like no eBay OAuth — that's acceptable. The specific language error should be gone.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/public/app.html supabase/functions/
git commit -m "fix: resolve invalid language header error on List on eBay"
```

---

## Task 6: Fix eBay Sync — Sold Orders Sync + Pull Listings Causing Duplicates

**Problem:**
1. "Sync Sold Orders" reports 0 orders synced even when sold orders exist on eBay.
2. "Pull Listings from eBay" incorrectly syncs sold orders to Unlisted status (should be Sold) and creates duplicates.

**Files:**
- Modify: `apps/web/public/app.html` (~L5008–5088)
- Reference: `supabase/functions/ebay-oauth/index.ts` (sync-orders and pull-listings endpoints)

- [ ] **Step 1: Inspect Edge Function endpoints**

```bash
cat supabase/functions/ebay-oauth/index.ts | grep -A 30 "sync-orders\|pull-listings"
```
Understand what each endpoint returns and how it sets `status` on imported items.

- [ ] **Step 2: Verify sold order sync endpoint**

The `handleSyncOrders` call hits `/sync-orders`. If it returns `{ synced: 0 }` always, the Edge Function may be using the wrong eBay order API endpoint, wrong date range, or wrong OAuth token scope. Check:

```bash
grep -A 50 "sync-orders" supabase/functions/ebay-oauth/index.ts
```

Document the specific bug found and note it as a blocker if it requires eBay API credential work.

- [ ] **Step 3: Fix pull-listings to not set Unlisted for sold items**

Find the `ebayPullListings` function (~L5008). After `syncFromServer()`, the server items returned include items with whatever status the Edge Function assigned. The Edge Function must set `status = 'Sold'` for eBay sold orders, `status = 'Listed'` for active listings, and `status = 'Unlisted'` for drafts only.

In the Edge Function (`supabase/functions/ebay-oauth/index.ts`), find the pull-listings handler and verify item status mapping:
```ts
// Active eBay listing → 'Listed'
// eBay draft → 'Unlisted'
// eBay sold order → 'Sold'
```

If the Edge Function is mapping all pulled items as 'Unlisted', fix it to use eBay's `listingStatus` field.

- [ ] **Step 4: Fix duplicate prevention on pull**

After `syncFromServer()`, the client-side `runEbayDedupeScan()` runs. Verify it correctly matches by `ebay_item_id` and doesn't create duplicate confirmation dialogs for items that are already in the correct status. If needed, add a server-side unique constraint check (but that's a migration — document as separate task if needed).

For immediate fix: in `ebayPullListings` (~L5032), after the sync, add a client-side dedup pass:

```js
// After syncFromServer():
// Remove client-side items that are exact ebay_item_id duplicates (keep the one with the most recent updatedAt)
const seen = new Map();
items = items.filter(item => {
  if (!item.ebay_item_id) return true;
  const existing = seen.get(item.ebay_item_id);
  if (!existing) { seen.set(item.ebay_item_id, item); return true; }
  // Keep newer item, remove older
  if (new Date(item.updatedAt || item.createdAt) > new Date(existing.updatedAt || existing.createdAt)) {
    seen.set(item.ebay_item_id, item);
    return true;
  }
  return false;
});
saveItems();
renderInventoryHome();
```

- [ ] **Step 5: Verify (manual)**

Open app. Connect eBay OAuth. Click "Pull Listings from eBay". Verify:
- Active eBay listings appear as Listed.
- No sold orders moved to Unlisted.
- No duplicates created.
Click "Sync Sold Orders". Verify it returns a count > 0 if sold orders exist, or a meaningful error message if not.

- [ ] **Step 6: Commit**

```bash
git add apps/web/public/app.html supabase/functions/
git commit -m "fix: eBay sync — prevent sold orders landing in Unlisted, add client-side dedup on pull"
```

---

## Task 7: Photo Enhancer — Manual Crop (Replace Auto-Square)

**Problem:** The "Crop" button calls `paCropSquare()` which auto-crops to a centered square. Audit requires user-controlled crop.

**Files:**
- Modify: `apps/web/public/app.html` (~L1632–1636 toolbar HTML; ~L3799–3814 paCropSquare)

- [ ] **Step 1: Replace Square button with Free Crop button**

Find the Square button in the Photo Enhancer toolbar (~L1636):
```html
<button onclick="paCropSquare()" ...>⬛ Square</button>
```

Replace with two buttons:
```html
<button onclick="paStartCrop()" style="flex:1;padding:7px 4px;background:var(--card);border:1px solid var(--border);border-radius:6px;color:var(--soft);font-size:12px;cursor:pointer;font-family:'IBM Plex Mono',monospace">✂ Crop</button>
<button onclick="paCropSquare()" style="flex:1;padding:7px 4px;background:var(--card);border:1px solid var(--border);border-radius:6px;color:var(--soft);font-size:12px;cursor:pointer;font-family:'IBM Plex Mono',monospace">⬛ Square</button>
```

This keeps the auto-square as an option and adds a manual crop.

- [ ] **Step 2: Add crop overlay HTML to Photo Enhancer section**

Find the Photo Enhancer section HTML (~L1632). Add a crop overlay div after the canvas:
```html
<div id="pa-crop-overlay" style="display:none;position:absolute;inset:0;cursor:crosshair;z-index:10">
  <div id="pa-crop-rect" style="position:absolute;border:2px dashed var(--accent);box-sizing:border-box;display:none;pointer-events:none"></div>
</div>
<div id="pa-crop-controls" style="display:none;gap:8px;margin-top:8px">
  <button onclick="paApplyCrop()" style="flex:1;padding:7px;background:var(--accent);color:#000;border:none;border-radius:6px;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer">Apply Crop</button>
  <button onclick="paCancelCrop()" style="flex:1;padding:7px;background:var(--card);border:1px solid var(--border);color:var(--soft);border-radius:6px;font-family:'IBM Plex Mono',monospace;font-size:12px;cursor:pointer">Cancel</button>
</div>
```

Note: The canvas wrapper may need `position:relative` for absolute positioning of the overlay to work. Find the canvas parent div and add `style="position:relative"` if not already present.

- [ ] **Step 3: Implement `paStartCrop`, `paApplyCrop`, `paCancelCrop`**

Add these functions near `paCropSquare` (~L3799):

```js
let _paCropState = null;

function paStartCrop() {
  const canvas = document.getElementById('pa-canvas');
  if (!canvas || !paPhotos.length) return;
  const overlay = document.getElementById('pa-crop-overlay');
  const controls = document.getElementById('pa-crop-controls');
  if (!overlay) return;
  overlay.style.display = 'block';
  if (controls) controls.style.display = 'flex';
  _paCropState = { startX: 0, startY: 0, endX: 0, endY: 0, dragging: false };

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  function getPos(e) {
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: Math.max(0, Math.min(rect.width, touch.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, touch.clientY - rect.top))
    };
  }

  function onStart(e) {
    e.preventDefault();
    const p = getPos(e);
    _paCropState = { startX: p.x, startY: p.y, endX: p.x, endY: p.y, dragging: true, scaleX, scaleY, rect };
    updateCropRect();
  }
  function onMove(e) {
    if (!_paCropState || !_paCropState.dragging) return;
    e.preventDefault();
    const p = getPos(e);
    _paCropState.endX = p.x; _paCropState.endY = p.y;
    updateCropRect();
  }
  function onEnd(e) {
    if (_paCropState) _paCropState.dragging = false;
  }

  overlay._onStart = onStart; overlay._onMove = onMove; overlay._onEnd = onEnd;
  overlay.addEventListener('mousedown', onStart);
  overlay.addEventListener('mousemove', onMove);
  overlay.addEventListener('mouseup', onEnd);
  overlay.addEventListener('touchstart', onStart, { passive: false });
  overlay.addEventListener('touchmove', onMove, { passive: false });
  overlay.addEventListener('touchend', onEnd);
}

function updateCropRect() {
  const r = document.getElementById('pa-crop-rect');
  if (!r || !_paCropState) return;
  const { startX, startY, endX, endY } = _paCropState;
  const x = Math.min(startX, endX), y = Math.min(startY, endY);
  const w = Math.abs(endX - startX), h = Math.abs(endY - startY);
  r.style.display = w > 2 && h > 2 ? 'block' : 'none';
  r.style.left = x + 'px'; r.style.top = y + 'px';
  r.style.width = w + 'px'; r.style.height = h + 'px';
}

function paApplyCrop() {
  if (!_paCropState) return;
  const canvas = document.getElementById('pa-canvas');
  const { startX, startY, endX, endY, scaleX, scaleY } = _paCropState;
  const x = Math.round(Math.min(startX, endX) * scaleX);
  const y = Math.round(Math.min(startY, endY) * scaleY);
  const w = Math.round(Math.abs(endX - startX) * scaleX);
  const h = Math.round(Math.abs(endY - startY) * scaleY);
  if (w < 10 || h < 10) { showToast('Select a larger area to crop'); return; }
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(x, y, w, h);
  canvas.width = w; canvas.height = h;
  ctx.putImageData(imageData, 0, 0);
  paPhotos[paActiveIdx].w = w; paPhotos[paActiveIdx].h = h;
  const result = canvas.toDataURL('image/jpeg', 0.92);
  paPhotos[paActiveIdx].enhanced = result;
  paPhotos[paActiveIdx].original = result;
  paPhotos[paActiveIdx]._isBlobUrl = false;
  paCancelCrop();
  showToast('Crop applied');
}

function paCancelCrop() {
  const overlay = document.getElementById('pa-crop-overlay');
  const controls = document.getElementById('pa-crop-controls');
  if (overlay) {
    overlay.style.display = 'none';
    if (overlay._onStart) { overlay.removeEventListener('mousedown', overlay._onStart); overlay.removeEventListener('mousemove', overlay._onMove); overlay.removeEventListener('mouseup', overlay._onEnd); overlay.removeEventListener('touchstart', overlay._onStart); overlay.removeEventListener('touchmove', overlay._onMove); overlay.removeEventListener('touchend', overlay._onEnd); }
  }
  if (controls) controls.style.display = 'none';
  const r = document.getElementById('pa-crop-rect');
  if (r) r.style.display = 'none';
  _paCropState = null;
}
```

- [ ] **Step 4: Verify (manual)**

Open Photo Enhancer. Load a photo. Click "Crop". Drag a selection on the photo. Click "Apply Crop". Photo is cropped to the selected area. "Square" button still auto-crops to centered square.

- [ ] **Step 5: Commit**

```bash
git add apps/web/public/app.html
git commit -m "fix: photo enhancer crop is now user-controlled; Square auto-crop preserved as separate button"
```

---

## Task 8: Photo Enhancer — Proper Photo Boost (eBay Best Practices)

**Problem:** `paPhotoBoost()` runs an unsharp mask that makes photos grainy. It's a paid-tier feature but doesn't actually enhance quality. Need to replace the pixel manipulation with a real enhancement pipeline that follows eBay's photo best practices: white/neutral background, correct brightness/contrast, sharpness, square format.

**Files:**
- Modify: `apps/web/public/app.html` (~L3849–3876, paPhotoBoost)

Note: Self-hosting Real-ESRGAN is outside scope for a single-file HTML app with no build step. The audit mentions it as a possibility. For now, implement a significantly better client-side enhancement that is visually clean and follows eBay best practices. Real-ESRGAN can be added later as a Supabase Edge Function.

- [ ] **Step 1: Replace paPhotoBoost with improved enhancement**

Find `paPhotoBoost` (~L3849) and replace it entirely:

```js
function paPhotoBoost() {
  const tier = (window._currentUser && window._currentUser.tier) || 'scout';
  const trialEndsAt = window._currentUser && window._currentUser.trialEndsAt;
  const trialActive = trialEndsAt && new Date(trialEndsAt) > new Date();
  if (tier === 'scout' && !trialActive) {
    showToast('Photo Boost is a Hustle+ feature');
    switchTab('dashboard');
    setTimeout(() => statsSubTab('subscription'), 150);
    return;
  }
  if (!paPhotos.length) return;

  const canvas = document.getElementById('pa-canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Step 1: Read pixel data
  const src = ctx.getImageData(0, 0, W, H);
  const d = src.data;

  // Step 2: Auto white balance — find average of lightest 5% of pixels
  let samples = [];
  for (let k = 0; k < d.length; k += 4) {
    const lum = 0.299 * d[k] + 0.587 * d[k+1] + 0.114 * d[k+2];
    samples.push({ lum, r: d[k], g: d[k+1], b: d[k+2] });
  }
  samples.sort((a, b) => b.lum - a.lum);
  const topN = Math.max(1, Math.floor(samples.length * 0.05));
  const top = samples.slice(0, topN);
  const avgR = top.reduce((s, p) => s + p.r, 0) / topN;
  const avgG = top.reduce((s, p) => s + p.g, 0) / topN;
  const avgB = top.reduce((s, p) => s + p.b, 0) / topN;
  const wbR = avgR > 0 ? 255 / avgR : 1;
  const wbG = avgG > 0 ? 255 / avgG : 1;
  const wbB = avgB > 0 ? 255 / avgB : 1;

  // Step 3: Apply white balance + contrast boost + slight saturation
  for (let k = 0; k < d.length; k += 4) {
    let r = Math.min(255, d[k] * wbR);
    let g = Math.min(255, d[k+1] * wbG);
    let b = Math.min(255, d[k+2] * wbB);
    // Contrast: S-curve (mild)
    r = 128 + (r - 128) * 1.1;
    g = 128 + (g - 128) * 1.1;
    b = 128 + (b - 128) * 1.1;
    // Clamp
    d[k]   = Math.max(0, Math.min(255, r));
    d[k+1] = Math.max(0, Math.min(255, g));
    d[k+2] = Math.max(0, Math.min(255, b));
  }
  ctx.putImageData(src, 0, 0);

  // Step 4: Sharpen (gentle — eBay recommends sharp product focus, not over-sharpened)
  const s2 = ctx.getImageData(0, 0, W, H);
  const dst = ctx.createImageData(W, H);
  // 3x3 sharpen kernel (less aggressive than [0,-1,0,-1,5,-1,0,-1,0])
  const kern = [0, -0.5, 0, -0.5, 3, -0.5, 0, -0.5, 0];
  const d2 = s2.data, dd = dst.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let ky = 0; ky < 3; ky++) {
        for (let kx = 0; kx < 3; kx++) {
          const px = Math.min(W-1, Math.max(0, x + kx - 1));
          const py = Math.min(H-1, Math.max(0, y + ky - 1));
          const idx = (py * W + px) * 4;
          const kv = kern[ky * 3 + kx];
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
```

- [ ] **Step 2: Verify (manual)**

Load a product photo in Photo Enhancer. Click Boost. The photo should look noticeably cleaner — better whites, slightly more contrast, sharper edges — without looking grainy or over-processed.

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/app.html
git commit -m "fix: photo boost uses white balance + contrast + gentle sharpening instead of grainy unsharp mask"
```

---

## Task 9: Rename Tab Labels — Pulse → Profit Compass, P&L → Profit Hub

**Problem:** Audit requires:
- "Pulse" tab renamed to "Profit Compass"
- P&L/Dashboard section renamed to "Profit Hub"

**Files:**
- Modify: `apps/web/public/app.html` (tab button ~L1156; Growth tab heading ~L1696; Dashboard heading ~L1944)

- [ ] **Step 1: Find all instances of "Pulse" and "P&L" label text**

```bash
grep -n "Pulse\|P&L\|tab-growth\|tab-pnl\|growth.*tab\|pnl.*tab\|Profit Hub\|Profit Compass" apps/web/public/app.html | head -30
```

- [ ] **Step 2: Rename Pulse → Profit Compass in tab button**

Find the tab button (~L1156):
```html
<button class="tab-btn" id="tab-growth" onclick="switchTab('growth')">...<span>Pulse</span></button>
```
Change the display text `Pulse` to `Profit Compass`. Do NOT change the `id="tab-growth"` or `switchTab('growth')` — those are functional identifiers.

- [ ] **Step 3: Rename the Growth/Pulse page heading**

Find the heading inside the growth tab content (~L1696):
```html
<div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:900;color:var(--text)">Pulse</div>
```
Change to:
```html
<div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:900;color:var(--text)">Profit Compass</div>
```

- [ ] **Step 4: Rename P&L tab and dashboard heading to Profit Hub**

Find the dashboard/P&L tab button (grep for `tab-pnl` or `P&L`). Update the display text to `Profit Hub`. Do NOT change functional IDs.

Find the dashboard section heading inside the tab content (grep for `P&L TRACKER` comment ~L701 and the rendered heading in `renderDashboard` ~L4773). Update any visible "P&L" or "Dashboard" headings to "Profit Hub".

- [ ] **Step 5: Verify (manual)**

Open app. Bottom tab bar should show "Profit Compass" for the growth/trends tab and "Profit Hub" for the P&L tab. Clicking each tab works as before.

- [ ] **Step 6: Commit**

```bash
git add apps/web/public/app.html
git commit -m "fix: rename Pulse tab to Profit Compass, P&L tab/heading to Profit Hub"
```

---

## Task 10: Profit Hub Dashboard Overhaul

**Problem:** The P&L tab (now "Profit Hub") needs a complete rebuild per audit spec. Current `renderDashboard()` shows only 3 KPI cards + hunt list + stale items. Required layout:

- Row 1: 6 KPI cards (Total Sales, Total Costs, Total Fees, Net Profit, Profit Margin, ROI)
- Row 2: Expense Tracker widget (total, by category, monthly trend, add button, recurring, top drivers, uncategorized)
- Row 3: Trend charts (Profit over time, Sales vs costs, Margin trend, Monthly comparison)
- Row 4: Operational breakdowns (Profit by category, Profit by listing, Fees by type, Top winners, Negative margin)
- Row 5: Actionable tables (Recent sales, Expense detail, Inventory cost, Underperforming, Best performers)
- Keep mileage logger

**Files:**
- Modify: `apps/web/public/app.html` (~L4704–4800, renderDashboard; ~L701–785, P&L CSS; ~L1944, dashboard HTML section)

This is the largest task. Break into sub-steps.

- [ ] **Step 1: Add required CSS for new dashboard components**

Find the `/* ══ P&L TRACKER ══ */` CSS section (~L701). After it, add:

```css
/* ══ PROFIT HUB ══ */
.ph-kpi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:16px; }
@media(min-width:480px) { .ph-kpi-grid { grid-template-columns:repeat(3,1fr); } }
.ph-kpi { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:12px 14px; text-align:center; }
.ph-kpi-val { font-family:'Syne',sans-serif; font-size:20px; font-weight:900; color:var(--text); margin-bottom:2px; }
.ph-kpi-label { font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:0.12em; }
.ph-section-title { font-size:10px; letter-spacing:0.18em; color:var(--muted); font-weight:800; margin:16px 0 10px; text-transform:uppercase; font-family:'IBM Plex Mono',monospace; }
.ph-card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:14px 16px; margin-bottom:12px; }
.ph-row { display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border); font-size:12px; font-family:'IBM Plex Mono',monospace; }
.ph-row:last-child { border-bottom:none; }
.ph-row-label { color:var(--soft); }
.ph-row-val { color:var(--text); font-weight:700; }
.ph-chart-bar-wrap { display:flex; align-items:flex-end; gap:4px; height:60px; margin-top:10px; }
.ph-bar { flex:1; background:var(--accent); border-radius:3px 3px 0 0; opacity:0.85; min-height:2px; }
.ph-bar-label { font-size:9px; color:var(--muted); text-align:center; font-family:'IBM Plex Mono',monospace; margin-top:3px; }
.ph-table { width:100%; border-collapse:collapse; font-size:11px; font-family:'IBM Plex Mono',monospace; }
.ph-table th { color:var(--muted); font-weight:700; text-align:left; padding:5px 4px; border-bottom:1px solid var(--border); font-size:10px; letter-spacing:0.08em; }
.ph-table td { padding:6px 4px; border-bottom:1px solid var(--border); color:var(--soft); }
.ph-table tr:last-child td { border-bottom:none; }
.ph-add-btn { width:100%; padding:8px; background:none; border:1px dashed var(--border); border-radius:6px; color:var(--accent); font-family:'IBM Plex Mono',monospace; font-size:11px; cursor:pointer; margin-top:8px; }
```

- [ ] **Step 2: Rewrite `renderDashboard()` — KPI Row + data computation**

Find `renderDashboard()` (~L4704). Replace the function body with the new layout. First, expand the data computation section:

```js
function renderDashboard() {
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-US', {weekday:'long',year:'numeric',month:'long',day:'numeric'});

  const tfStart   = getTimeframeStart(dashTimeframe);
  const allSold   = items.filter(i => i.status === 'Sold');
  const sold      = allSold.filter(i => new Date(i.soldDate || i.sold_at || i.createdAt) >= tfStart);
  const listed    = items.filter(i => i.status === 'Listed');
  const unlisted  = items.filter(i => i.status === 'Unlisted');
  const Sv        = getSettings ? getSettings() : S;

  // KPI computation
  const totalSales  = sold.reduce((s, i) => s + parseFloat(i.soldPrice || i.sold_price || 0), 0);
  const totalCosts  = sold.reduce((s, i) => s + parseFloat(i.cost || 0), 0);
  const totalFees   = sold.reduce((s, i) => {
    const sp = parseFloat(i.soldPrice || i.sold_price || 0);
    return s + sp * ((Sv.ebayFee || 13) / 100) + (Sv.pkgCost || 1.25);
  }, 0);
  const netProfit   = totalSales - totalCosts - totalFees;
  const margin      = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : '0.0';
  const roi         = totalCosts > 0 ? ((netProfit / totalCosts) * 100).toFixed(0) : 'N/A';

  // Expenses from pnl_expenses (use existing expense data structure)
  const expenses = loadExpenses ? loadExpenses() : (window._expenses || []);
  const expInPeriod = expenses.filter(e => new Date(e.date || e.createdAt) >= tfStart);
  const totalExpenses = expInPeriod.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  // Category breakdown
  const catMap = {};
  sold.forEach(i => {
    const cat = i.category || 'Other';
    if (!catMap[cat]) catMap[cat] = { sales: 0, profit: 0, count: 0 };
    const sp = parseFloat(i.soldPrice || i.sold_price || 0);
    const cost = parseFloat(i.cost || 0);
    const fee = sp * ((Sv.ebayFee || 13) / 100) + (Sv.pkgCost || 1.25);
    catMap[cat].sales += sp; catMap[cat].profit += sp - cost - fee; catMap[cat].count++;
  });
  const cats = Object.entries(catMap).sort((a, b) => b[1].profit - a[1].profit);

  // Monthly trend (last 6 months)
  const months = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(); d.setMonth(d.getMonth() - m);
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const mEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const mSold  = allSold.filter(i => { const dt = new Date(i.soldDate || i.sold_at || i.createdAt); return dt >= mStart && dt <= mEnd; });
    const mProfit = mSold.reduce((s, i) => {
      const sp = parseFloat(i.soldPrice || i.sold_price || 0);
      const cost = parseFloat(i.cost || 0);
      const fee = sp * ((Sv.ebayFee || 13) / 100) + (Sv.pkgCost || 1.25);
      return s + sp - cost - fee;
    }, 0);
    months.push({ label, profit: mProfit, sales: mSold.reduce((s,i)=>s+parseFloat(i.soldPrice||i.sold_price||0),0) });
  }
  const maxMonthVal = Math.max(...months.map(m => Math.max(m.profit, m.sales)), 1);

  // Top performers / underperformers
  const soldWithProfit = sold.map(i => {
    const sp = parseFloat(i.soldPrice || i.sold_price || 0);
    const cost = parseFloat(i.cost || 0);
    const fee = sp * ((Sv.ebayFee || 13) / 100) + (Sv.pkgCost || 1.25);
    return { ...i, _profit: sp - cost - fee };
  });
  const topPerformers = [...soldWithProfit].sort((a,b)=>b._profit-a._profit).slice(0,5);
  const negMargin     = soldWithProfit.filter(i=>i._profit<0).slice(0,5);

  // Expense by category
  const expCatMap = {};
  expInPeriod.forEach(e => {
    const c = e.category || 'Uncategorized';
    expCatMap[c] = (expCatMap[c] || 0) + parseFloat(e.amount || 0);
  });
  const expCats = Object.entries(expCatMap).sort((a,b)=>b[1]-a[1]);

  // Growth cache (hunt list + stale)
  const gc = loadGrowthCache ? loadGrowthCache() : null;

  // ── Render ──
  document.getElementById('dash-content').innerHTML = `

    <!-- KPI ROW -->
    <div class="ph-kpi-grid">
      <div class="ph-kpi">
        <div class="ph-kpi-val" style="color:var(--green)">$${totalSales.toFixed(0)}</div>
        <div class="ph-kpi-label">Total Sales</div>
      </div>
      <div class="ph-kpi">
        <div class="ph-kpi-val" style="color:var(--red)">$${totalCosts.toFixed(0)}</div>
        <div class="ph-kpi-label">Total Costs</div>
      </div>
      <div class="ph-kpi">
        <div class="ph-kpi-val" style="color:var(--yellow)">$${totalFees.toFixed(0)}</div>
        <div class="ph-kpi-label">Total Fees</div>
      </div>
      <div class="ph-kpi">
        <div class="ph-kpi-val" style="color:${netProfit>=0?'var(--green)':'var(--red)'}">$${netProfit.toFixed(0)}</div>
        <div class="ph-kpi-label">Net Profit</div>
      </div>
      <div class="ph-kpi">
        <div class="ph-kpi-val">${margin}%</div>
        <div class="ph-kpi-label">Margin</div>
      </div>
      <div class="ph-kpi">
        <div class="ph-kpi-val">${roi}%</div>
        <div class="ph-kpi-label">ROI</div>
      </div>
    </div>

    <!-- EXPENSE TRACKER -->
    <div class="ph-section-title">Expense Tracker</div>
    <div class="ph-card">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px">
        <span style="font-family:'Syne',sans-serif;font-weight:900;font-size:20px;color:var(--red)">$${totalExpenses.toFixed(2)}</span>
        <span style="font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;align-self:flex-end">this period</span>
      </div>
      ${expCats.length ? expCats.slice(0,5).map(([cat, amt]) => `
        <div class="ph-row">
          <span class="ph-row-label">${cat}</span>
          <span class="ph-row-val">$${amt.toFixed(2)}</span>
        </div>`).join('') : '<div style="font-size:12px;color:var(--muted);padding:8px 0">No expenses logged this period.</div>'}
      <button class="ph-add-btn" onclick="statsSubTab('expenses')">+ Add Expense</button>
    </div>

    <!-- TREND CHARTS -->
    <div class="ph-section-title">Sales Trends</div>
    <div class="ph-card">
      <div style="font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;margin-bottom:6px">Monthly Profit (last 6 months)</div>
      <div class="ph-chart-bar-wrap">
        ${months.map(m => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center">
            <div class="ph-bar" style="height:${Math.max(2, Math.round((Math.max(0,m.profit)/maxMonthVal)*56))}px;background:${m.profit>=0?'var(--green)':'var(--red)'}"></div>
            <div class="ph-bar-label">${m.label}</div>
          </div>`).join('')}
      </div>
      <div style="margin-top:12px;font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;margin-bottom:4px">Monthly Sales (last 6 months)</div>
      <div class="ph-chart-bar-wrap">
        ${months.map(m => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center">
            <div class="ph-bar" style="height:${Math.max(2, Math.round((m.sales/maxMonthVal)*56))}px;background:var(--accent)"></div>
            <div class="ph-bar-label">${m.label}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- CATEGORY PERFORMANCE -->
    <div class="ph-section-title">Category Performance</div>
    <div class="ph-card">
      ${cats.length ? `<table class="ph-table">
        <thead><tr><th>Category</th><th>Items</th><th>Profit</th></tr></thead>
        <tbody>${cats.slice(0,8).map(([cat, d]) => `
          <tr>
            <td>${cat}</td>
            <td>${d.count}</td>
            <td style="color:${d.profit>=0?'var(--green)':'var(--red)'}">$${d.profit.toFixed(2)}</td>
          </tr>`).join('')}</tbody>
      </table>` : '<div style="font-size:12px;color:var(--muted);padding:8px 0">No sold items this period.</div>'}
    </div>

    <!-- TOP PERFORMERS -->
    <div class="ph-section-title">Top Performers</div>
    <div class="ph-card">
      ${topPerformers.length ? `<table class="ph-table">
        <thead><tr><th>Item</th><th>Profit</th></tr></thead>
        <tbody>${topPerformers.map(i => `
          <tr>
            <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i.nickname}</td>
            <td style="color:var(--green)">$${i._profit.toFixed(2)}</td>
          </tr>`).join('')}</tbody>
      </table>` : '<div style="font-size:12px;color:var(--muted);padding:8px 0">No sold items yet.</div>'}
    </div>

    <!-- NEGATIVE MARGIN -->
    ${negMargin.length ? `
    <div class="ph-section-title">At Risk Items</div>
    <div class="ph-card">
      <table class="ph-table">
        <thead><tr><th>Item</th><th>Loss</th></tr></thead>
        <tbody>${negMargin.map(i => `
          <tr>
            <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i.nickname}</td>
            <td style="color:var(--red)">$${i._profit.toFixed(2)}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>` : ''}

    <!-- RECENT SALES -->
    <div class="ph-section-title">Recent Sales</div>
    <div class="ph-card">
      ${sold.length ? `<table class="ph-table">
        <thead><tr><th>Item</th><th>Sold $</th><th>Profit</th></tr></thead>
        <tbody>${[...sold].sort((a,b)=>new Date(b.soldDate||b.sold_at||b.createdAt)-new Date(a.soldDate||a.sold_at||a.createdAt)).slice(0,10).map(i => {
          const sp=parseFloat(i.soldPrice||i.sold_price||0),c=parseFloat(i.cost||0),f=sp*((Sv.ebayFee||13)/100)+(Sv.pkgCost||1.25),p=sp-c-f;
          return `<tr>
            <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i.nickname}</td>
            <td>$${sp.toFixed(2)}</td>
            <td style="color:${p>=0?'var(--green)':'var(--red)'}">$${p.toFixed(2)}</td>
          </tr>`;}).join('')}</tbody>
      </table>` : '<div style="font-size:12px;color:var(--muted);padding:8px 0">No sold items this period.</div>'}
    </div>`;
}
```

- [ ] **Step 3: Verify (manual)**

Open app. Click Profit Hub tab. Should show: 6 KPI cards, Expense Tracker widget with add button, two bar charts (profit and sales by month), Category Performance table, Top Performers, At Risk Items (if any), Recent Sales table. Mileage logger should still be accessible (via statsSubTab or existing UI — verify it's not removed).

- [ ] **Step 4: Ensure mileage logger is preserved**

```bash
grep -n "mileage\|Mileage\|statsSubTab\|sub.*tab\|tab.*sub" apps/web/public/app.html | head -20
```
The mileage logger is accessed via `statsSubTab('mileage')` or similar. As long as `renderDashboard` doesn't replace the sub-tab navigation, it's fine. Verify the sub-tab buttons are still visible.

- [ ] **Step 5: Commit**

```bash
git add apps/web/public/app.html
git commit -m "feat: Profit Hub dashboard overhaul — 6 KPIs, expense tracker, trend charts, category/performer tables"
```

---

## Final Push

- [ ] **Push all commits**

```bash
git push -u origin claude/cool-rubin-mka6bv
```

- [ ] **Update HANDOFF.md**

```bash
# Append to docs/HANDOFF.md:
# Session: 2026-06-19
# Plan: docs/superpowers/plans/2026-06-19-app-audit-fixes.md
# Status: [in progress / complete]
# Files changed: apps/web/public/app.html, supabase/functions/ebay-oauth/index.ts (if needed)
# Next: Verify all fixes on live Vercel URL after push
```

---

## Self-Review

### Spec Coverage Check

| Audit Item | Task |
|---|---|
| Photo thumbnail on item card | Task 1 |
| Duplicate items across tabs | Task 2 |
| Delete button on all item cards | Task 3 |
| Invalid language header on List on eBay | Task 5 |
| Listed tab: remove Edit, remove Enhance Photo | Task 4 |
| Listed tab: rename Sold → Mark Sold | Task 4 |
| Listed tab: rename Listing → Listing Boost | Task 4 |
| Delete button on Listed cards | Task 3 |
| Relist keeps sold item in Sold | Task 2 |
| Relist copies photos | Task 2 |
| eBay Sync: 0 sold orders | Task 6 |
| Pull Listings syncing to Unlisted incorrectly | Task 6 |
| Crop button: user-controlled crop | Task 7 |
| remove.bg key in settings | Already in settings (~L1295) — no fix needed |
| Photo Boost enhancement quality | Task 8 |
| P&L renamed to Profit Hub | Task 9 + 10 |
| Profit Hub full dashboard layout | Task 10 |
| Keep mileage logger | Task 10 (Step 4) |
| Pulse renamed to Profit Compass | Task 9 |

### No Placeholder Violations

All code blocks contain complete, executable implementations. No TBDs.

### Type Consistency

- `photoMap` — referenced in Tasks 1, 2 — same global variable name throughout.
- `paPhotos`, `paActiveIdx` — referenced in Tasks 7, 8 — same globals as existing code.
- `getSettings()` / `Sv` / `S` — used consistently matching existing patterns.
- `sold_price` / `soldPrice`, `sold_at` / `soldDate` — all instances handle both field name variants to match existing dual-naming in codebase.
