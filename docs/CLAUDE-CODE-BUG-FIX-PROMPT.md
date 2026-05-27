# Flippd Bug Fix — Claude Code Prompt

> Copy everything below the line and paste directly into Claude Code.

---

You are fixing all known bugs in the Flippd app. The file to fix is `Flippd_v5_23.html` (single-file HTML/JS app, ~6,642 lines). Read the entire file before making any changes. When done, save the fixed version as `Flippd_v5_24.html` — do NOT overwrite the original.

Work through every bug below in order. For each one: find the exact location, apply the fix, move to the next. Do not skip any. Do not summarize what you're going to do — just do it.

---

## CRITICAL (fix these first)

---

### BUG C-01 — Photo save corruption on edit
**Location:** `saveInvItem()` — the block that builds the merged photo array when editing an existing item.
**Problem:** When a user edits an item and adds a new photo, `invFormImgB64` is set to the sentinel string `'HAS_FILE'` (not actual base64 data). The code builds `data:${invFormImgType};base64,${invFormImgB64}` which produces the corrupt URL `"data:image/jpeg;base64,HAS_FILE"`. This silently breaks the item's photo display.
**Fix:** In the edit path inside `saveInvItem()`, when `invFormImgFile` exists (a real File object), convert it to a blob URL using `URL.createObjectURL(invFormImgFile)` before adding it to `mergedPhotos`. Do not use `invFormImgB64` for the image data URL in the edit path. If `savePhotosIDB()` exists and is the correct storage method, route through it instead.

---

### BUG C-02 — saveAndGenerateListing() guard never fires
**Location:** `saveAndGenerateListing()` — the line `if (saved === false) return;`
**Problem:** `saveInvItem()` has no `return` statement on success or failure — it returns `undefined` in both cases. The guard `if (saved === false)` can never be true. If validation fails (e.g. empty item name), `saveInvItem()` alerts and returns `undefined`, but `saveAndGenerateListing()` continues executing and tries to open a listing modal for the wrong item.
**Fix:** 
1. Make `saveInvItem()` explicitly `return true` on success and `return false` on validation failure (before every `alert()` or `showToast()` call that represents a validation error).
2. Change the guard in `saveAndGenerateListing()` to: `if (!saved) return;`

---

### BUG C-03 — showSourcingSettings wrapper bypassed by hoisting
**Location:** The block near line 4366 that wraps `window.showSourcingSettings` to inject `checkEbayStatus()`.
**Problem:** `showSourcingSettings` is a function declaration, which is hoisted. All `onclick="showSourcingSettings()"` calls in the HTML invoke the hoisted local function, completely bypassing the `window.showSourcingSettings` wrapper. `checkEbayStatus()` is never called when the settings panel opens, so the eBay connection status always shows "Checking..." forever.
**Fix:** Remove the wrapper pattern entirely. Instead, add `checkEbayStatus();` as the first line inside the body of the `showSourcingSettings` function declaration itself.

---

### BUG C-04 — Deleted seed items resurrect on every reload
**Location:** `loadItems()` — the merge logic that combines `SEED_ITEMS` with saved localStorage items.
**Problem:** When a user deletes a seed item (IDs 1–29), it's removed from `items` and from localStorage. But on the next load, the merge loop re-adds every seed item that isn't found in saved data, resurrecting deleted items permanently.
**Fix:** 
1. Add a `const DELETED_SEED_KEY = 'flippd_deleted_seed_ids';` constant.
2. In the delete function (wherever `items.splice(...)` or `items = items.filter(...)` removes an item), if the deleted item's `id` matches a seed item ID, add that ID to a Set stored in `localStorage.setItem(DELETED_SEED_KEY, JSON.stringify([...deletedIds]))`.
3. In `loadItems()`, before the merge loop, load the deleted seed IDs: `const deletedSeedIds = new Set(JSON.parse(localStorage.getItem(DELETED_SEED_KEY)||'[]'))`. Then filter: `const seedsToAdd = SEED_ITEMS.filter(s => !saved.find(sv => sv.id === s.id) && !deletedSeedIds.has(s.id))`.

---

## HIGH (fix after criticals)

---

### BUG H-01 — Dual profit calculation functions diverge on shipping
**Location:** `calcProfit()` and `calcFinancials()` — two separate profit calculation functions.
**Problem:** `calcProfit()` never includes shipping cost. `calcFinancials()` adds `shipCost` when `S.shipping === 'free'`. The sourcing result screen uses `calcFinancials()` while inventory, P&L, and buy-confirm modal all use `calcProfit()`. The profit shown on the scan result card can differ from the profit stored on the item.
**Fix:** Add an optional `shipCost` parameter to `calcProfit()`: `function calcProfit(cost, price, shipCost = 0)`. Inside, include `shipCost` in the deduction: `return price - cost - calcEbayFee(price) - shipCost`. Then update `calcFinancials()` to call `calcProfit()` instead of duplicating the math, passing `S.shipping === 'free' ? S.shipCost : 0` as the third argument. This makes one canonical function for all profit math.

---

### BUG H-02 — HOT threshold default conflicts with spec
**Location:** `DEFAULTS` object — the `targetRoi` field.
**Problem:** `DEFAULTS.targetRoi` is set to `200`. But the spec says HOT = ROI > 150%, BUY = ROI > min_roi (default 50%). With `targetRoi = 200`, items at 180% ROI are classified BUY instead of HOT, silently under-classifying good finds.
**Fix:** Change `targetRoi` default from `200` to `150` in `DEFAULTS`. Update the settings UI label/tooltip for this field to read "HOT threshold ROI (%)" so the user understands what it controls.

---

### BUG H-03 — P&L applies eBay fee to all platforms
**Location:** `pnlCalc()` — the fee calculation that uses `S.ebayFee` on every sold item.
**Problem:** Items sold on Poshmark, Mercari, or Facebook Marketplace are charged the eBay fee rate, producing wrong net profit numbers in P&L.
**Fix:** In `pnlCalc()`, replace the flat `S.ebayFee` fee calculation with a platform-aware function. Add a helper `getPlatformFeePct(item)` that returns:
- Poshmark: `item.sellPrice > 15 ? 0.20 : 2.95 / item.sellPrice` (or flat $2.95 if under $15)
- Mercari: `0.10 + 0.029 + (0.50 / item.sellPrice)`
- Facebook Marketplace: `item.sellPrice >= 8 ? 0.05 : 0.40 / item.sellPrice`  
- Default (eBay): `S.ebayFee / 100`

Then use `getPlatformFeePct(item)` in the fee calculation per item.

---

### BUG H-04 — Photo tab advertises 12 photos but caps at 4
**Location:** `paHandlePhotos()` — `const remaining = 4 - paPhotos.length` and `paSaveToItem()` — `.slice(0, 4)`.
**Problem:** The UI label says "Enhance up to 12 photos" but the code enforces a hard cap of 4. Users hit the limit 3x sooner than advertised.
**Fix:** Change both: `const remaining = 12 - paPhotos.length` in `paHandlePhotos()` and `.slice(0, 12)` in `paSaveToItem()`.

---

### BUG H-05 — paApplyFilters() closure captures wrong index under rapid slider input
**Location:** `paApplyFilters()` — the `img.onload` callback.
**Problem:** `paActiveIdx` is captured by the `onload` closure at fire time, not at registration time. Rapid slider changes queue multiple `onload` callbacks that may write `paPhotos[i].enhanced` with the wrong index.
**Fix:** Capture the index at the time `paApplyFilters()` is called: add `const capturedIdx = paActiveIdx;` at the top of the function, then use `capturedIdx` everywhere inside the `img.onload` callback instead of `paActiveIdx`.

---

### BUG H-06 — Inventory search bar does nothing
**Location:** `renderFilteredList()` — missing branch for `invListFilter.type === 'search'`.
**Problem:** `invHomeSearch()` sets `invListFilter = {type:'search', value:q}` and calls `renderFilteredList()`, but `renderFilteredList()` only handles `type === 'status'` and `type === 'category'`. The search type has no branch, so all items are rendered unfiltered.
**Fix:** Add this branch inside `renderFilteredList()` before the return/render:
```js
if (invListFilter.type === 'search') {
  const q = invListFilter.value.toLowerCase();
  filtered = filtered.filter(i =>
    (i.nickname||'').toLowerCase().includes(q) ||
    (i.sku||'').toLowerCase().includes(q) ||
    (i.notes||'').toLowerCase().includes(q)
  );
}
```

---

### BUG H-07 — Trend line chart double-counts sales (cumulative, not period-specific)
**Location:** `renderTrendLine()` — the filter on `items` for each period bar.
**Problem:** Each bar filters `createdAt >= cutoff`, so a sale from 90 days ago appears in the 30-day, 60-day, and 90-day bars simultaneously. The chart is cumulative rather than showing sales per discrete period.
**Fix:** For each bar/period, filter items sold within a specific non-overlapping window. For example, for a 30-day bar: items where `soldAt` (or `createdAt` if no soldAt) is between `now - 30 days` and `now`. For 60-day: between `now - 60 days` and `now - 30 days`. Ensure non-overlapping ranges.

---

### BUG H-08 — Dashboard filters sold items by createdAt instead of soldAt
**Location:** `renderDashboard()` — the timeframe filter, and `getTimeframeStart()`.
**Problem:** Items are filtered using `new Date(i.createdAt || i.dateAcquired) >= tfStart`. `createdAt` is when the item was added to inventory, not when it sold. An item added in January and sold in April won't appear in an April "This Month" filter.
**Fix:** 
1. In `confirmSold()`, when marking an item as sold, add a `soldAt: new Date().toISOString()` field to the item and save it.
2. In `renderDashboard()` and `getTimeframeStart()`, filter sold items using `i.soldAt` when available: `new Date(i.soldAt || i.createdAt || i.dateAcquired) >= tfStart`.

---

### BUG H-09 — normaliseImportItem() sellPrice has wrong operator precedence
**Location:** `normaliseImportItem()` — the `sellPrice` field assignment.
**Problem:** The expression `raw.sellPrice || raw.estimated_value ? String(...) : ''` is parsed by JS as `raw.sellPrice || (raw.estimated_value ? String(...) : '')` due to operator precedence. The intent is `(raw.sellPrice || raw.estimated_value) ? String(...) : ''`.
**Fix:** Add parentheses: `sellPrice: (raw.sellPrice || raw.estimated_value) ? String(parseFloat(raw.sellPrice || raw.estimated_value) || 0) : ''`

---

## MEDIUM (fix after highs)

---

### BUG M-01 — Confirm modal renders with no styling (invisible)
**Location:** The `app-confirm-modal` HTML — the inner div with `class="modal-content"`.
**Problem:** `.modal-content` is not defined in the CSS. Only `.modal-box` is. The modal appears as unstyled floating text on a transparent background.
**Fix:** Change `class="modal-content"` to `class="modal-box"` on the inner div of `app-confirm-modal`.

---

### BUG M-02 — .btn-accent class not defined (button invisible)
**Location:** CSS — missing `.btn-accent` definition. Used on the "Save + Export" listing button.
**Problem:** The button has no background color and is effectively invisible.
**Fix:** Add to CSS: `.btn-accent { background: var(--accent); color: #fff; border: none; }` — or change the button's class to `btn-amber` which is already defined.

---

### BUG M-03 — Tier banner always visible on load
**Location:** `tier-banner` element — inline style attribute.
**Problem:** The inline style contains both `display:none` and later `display:flex` in the same attribute string. Browsers apply the last value (`display:flex`), so the banner is visible and empty on every page load before `updateTierBanner()` runs.
**Fix:** Remove `display:flex;align-items:center;justify-content:center;gap:8px` from the initial inline style. Keep only `display:none` in the initial HTML. Move the flex layout properties to a CSS class `.tier-banner { display:flex; align-items:center; justify-content:center; gap:8px; }` and apply it to the element. The JS show/hide logic should set `style.display = 'flex'` or `'none'` only.

---

### BUG M-04 — growth-score-card uses undefined CSS variable --border-dark
**Location:** `growth-score-card` — inline style `border:2px solid var(--border-dark)`.
**Problem:** `--border-dark` is not defined in the CSS token set. The border renders as transparent.
**Fix:** Replace `var(--border-dark)` with `var(--border)` or `#a08060` (the intended dark border color from the design spec).

---

### BUG M-05 — showInventoryDrillDown filterStatus assignment has no effect
**Location:** `showInventoryDrillDown()` — onclick handlers that set `filterStatus = '${status}'`.
**Problem:** `filterStatus` is a module-level variable but `renderInventory()` doesn't use it — inventory filtering is controlled by `invListFilter`. The assignment is silently ignored.
**Fix:** Replace `filterStatus='${status}'` in the onclick with `openFilteredList('status','${status}')` (or whatever the correct function is to trigger a filtered inventory view by status).

---

### BUG M-06 — Activity log uses mismatched localStorage keys
**Location:** `renderActivityFeed()` uses key `'fef_activity_log'`. `switchTab()` cleanup uses key `'fif_activity_log'`.
**Problem:** The cleanup in `switchTab` reads from a different key than the one written to, so the activity log is never trimmed and grows unbounded.
**Fix:** Define a single constant `const ACT_KEY = 'fef_activity_log'` and use it in both `renderActivityFeed()` and the `switchTab()` cleanup. Replace the hardcoded `'fif_activity_log'` string in `switchTab()` with `ACT_KEY`.

---

### BUG M-07 — Dashboard P&L panel reads wrong field name for expense description
**Location:** `sPnlRender()` — `e.description||'Expense'`.
**Problem:** Expenses are saved with key `desc` in `pnlAddExpense()`, but `sPnlRender()` reads `e.description`. All expenses show as "Expense" in the dashboard P&L panel.
**Fix:** Change `e.description||'Expense'` to `e.desc || e.description || 'Expense'` in `sPnlRender()`.

---

### BUG M-08 — P&L sold items with no sell price silently distort totals
**Location:** `pnlCalc()` — the reduce over sold items.
**Problem:** Items with `sellPrice: ''` contribute $0 to revenue but are still counted in item totals, skewing averages and totals silently.
**Fix:** In `pnlCalc()`, filter out sold items with no sell price before computing totals: `const sold = items.filter(i => i.status === 'Sold' && parseFloat(i.sellPrice) > 0)`. Separately track and surface a count of "sold items missing price" as a warning in the P&L UI.

---

### BUG M-09 — Native alert() calls break on Android WebView
**Location:** `showForgotPassword()`, `confirmSold()`, `saveInvItem()`, and any other place using `alert()` or `window.confirm()`.
**Problem:** Native `alert()` and `confirm()` dialogs are unreliable or blocked in Android WebView / PWA fullscreen mode.
**Fix:** Audit the entire file for all `alert(` and `window.confirm(` calls. Replace each:
- `alert(msg)` → `showToast(msg)` for non-blocking notifications
- `window.confirm(msg)` → `showAppConfirm(msg, onConfirm)` for destructive action confirmations
Keep the existing `showAppConfirm()` modal pattern which is already implemented.

---

### BUG M-10 — eBay Sync panel exists but is unreachable (no trigger button)
**Location:** `showEbaySyncPanel()` — defined but never called from any UI element.
**Problem:** The eBay sync panel HTML and JS exist but there is no button to open it. The feature is completely inaccessible.
**Fix:** Add a "Sync from eBay" button in the eBay settings section (near the eBay credentials input) that calls `showEbaySyncPanel()`. If the feature is not production-ready, add a `disabled` attribute and a tooltip: "Coming soon".

---

### BUG M-11 — analyze() JSON parse has unhelpful error message on truncated response
**Location:** `analyze()` — `const item = JSON.parse(raw)` with no try/catch.
**Problem:** If the API returns truncated/malformed JSON (e.g. max_tokens hit), the SyntaxError is caught by the outer catch but surfaces as a raw error message.
**Fix:** Wrap in try/catch with a user-friendly message:
```js
let item;
try { item = JSON.parse(raw); }
catch(e) { throw new Error('Response was incomplete — please try again'); }
```

---

### BUG M-12 — pnlCalc() missing null guard on S object
**Location:** `pnlCalc()` — all `S.ebayFee`, `S.pkgCost` accesses.
**Problem:** Unlike `calcProfit()` which guards `(S && S.ebayFee != null) ? S.ebayFee : 13`, `pnlCalc()` accesses `S.*` directly with no guard.
**Fix:** Use optional chaining throughout `pnlCalc()`: `(S?.ebayFee ?? 13)`, `(S?.pkgCost ?? 1.25)`, etc.

---

## LOW (fix last)

---

### BUG L-01 — exportListingsToCSV() category ID lookup always returns empty
**Location:** `exportListingsToCSV()` — `EBAY_LEAF_CATEGORIES[listing.ebayCategory]`.
**Problem:** `listing.ebayCategory` stores a numeric ID but `EBAY_LEAF_CATEGORIES` is keyed by human-readable name. The lookup always returns `''`.
**Fix:** In `exportListingsToCSV()`, build a reverse lookup map from the numeric IDs to names, or store `ebayCategoryName` alongside `ebayCategory` when saving a listing. Use `listing.ebayCategoryName || EBAY_LEAF_CATEGORIES[listing.ebayCategory] || ''`.

---

### BUG L-02 — Two SKU generation functions with different logic
**Location:** `generateSKU()` (uppercase) and `generateSku()` (lowercase).
**Problem:** Two separate functions exist with different counting logic. `generateSKU()` uses a prefix-match count that can over-count; `generateSku()` uses a safer max+1 pattern.
**Fix:** Remove `generateSKU()`. Replace all calls to `generateSKU()` with `generateSku()`. Ensure `generateSku()` handles all the same category prefixes.

---

### BUG L-03 — Duplicate @keyframes definitions
**Location:** CSS — `@keyframes fadeUp` defined twice, `@keyframes rowIn` defined twice.
**Fix:** Remove the first/earlier duplicate of each. Keep the second definition (which has the correct animation values).

---

### BUG L-04 — Duplicate position:sticky on .app-header
**Location:** CSS — `.app-header { position: sticky; }` appears twice.
**Fix:** Remove the duplicate declaration (keep the first one).

---

### BUG L-05 — paApplyToAll() 80ms timeout not reliable for large images
**Location:** `paApplyToAll()` — `setTimeout(res, 80)` inside the per-photo apply loop.
**Problem:** 80ms is not guaranteed to be enough for `img.onload` to fire on slow devices or large images.
**Fix:** Modify `paApplyFilters()` to return a Promise that resolves inside the `img.onload` callback (after `ctx.putImageData` completes). In `paApplyToAll()`, `await paApplyFilters()` instead of using a timeout.

---

### BUG L-06 — minStr and shipping settings exist but have no UI controls
**Location:** `DEFAULTS` — `minStr` and `shipping`/`shipCost` fields. `getDecision()` reads `S.minStr` but it can't be changed by the user.
**Fix:** Either add sliders/toggles for these settings in the Settings panel, or remove them from `getDecision()` and `calcFinancials()` to eliminate dead code. If keeping: add a "Min Sell-Through Rate" slider (0–100%) and a "Shipping" toggle (Buyer Pays / Seller Pays + cost input) to the settings panel.

---

### BUG L-07 — renderDashboard() dead guard on pnlCalc
**Location:** `renderDashboard()` — `const pnlData = pnlCalc ? pnlCalc() : null`.
**Problem:** `pnlCalc` is always defined (function declaration). The ternary guard is dead code and misleading.
**Fix:** Replace with `const pnlData = pnlCalc();`

---

### BUG L-08 — fetchTrendingKeywords() JSON.parse on potentially empty string
**Location:** `fetchTrendingKeywords()` — `JSON.parse(raw.replace(...).trim())`.
**Problem:** If the API returns no text content blocks, `raw` is `''` and `JSON.parse('')` throws `SyntaxError`.
**Fix:** Add before the parse: `if (!raw || !raw.trim()) throw new Error('Empty response from trends API');`

---

## AFTER ALL FIXES

1. Save the fixed file as `Flippd_v5_24.html` — do NOT overwrite `Flippd_v5_23.html`.
2. Run a quick self-check: search the fixed file for any remaining `alert(`, `window.confirm(`, `modal-content`, `btn-accent`, `border-dark`, `fif_activity_log`, `HAS_FILE` — these should all be resolved.
3. Report back: list every bug ID fixed, any you couldn't locate exactly (with reason), and any new issues you spotted while making the fixes.
