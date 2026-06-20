# Bug Fixes Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 10 confirmed bugs in ScanForProfit: trial banner width, shipping hint, shelf scan MIME type, tab rename, eBay orders CSV import, eBay active listing import status, duplicate item warning from scans, remove.bg key location, and Profit Hub dashboard routing.

**Architecture:** All changes live in `apps/web/public/app.html` (single-file ~8200-line vanilla JS/HTML/CSS web app) and `supabase/functions/claude-proxy/index.ts` (Deno edge function). No build step. Edits go directly to the files. Deploy: push edge function via `supabase functions deploy claude-proxy`.

**Tech Stack:** Vanilla JS, HTML, CSS. Supabase Edge Functions (Deno/TypeScript). IndexedDB for photos. No framework, no bundler.

## Global Constraints

- Never hardcode eBay fee %, mileage rate, or tax reserve — always from user settings object `S`
- Never call Anthropic API from client — always via Supabase Edge Function
- Never use `<form>` tags — use `onclick`/`onchange` handlers only
- Never add a 6th tab — 5 tabs only: Profit Scanner, Inventory, Photos, Profit Compass, Profit Hub
- File: `apps/web/public/app.html`. All changes in-place. No new files.
- After every task: `git add apps/web/public/app.html supabase/functions/claude-proxy/index.ts && git commit -m "fix: <description>"`
- Branch: `claude/cool-rubin-mka6bv`

---

## Task 1: Fix Trial Banner Width

**Problem:** The `#tier-banner` sticky element stretches full viewport width on desktop while all other content (`.app-header`, `.tab-bar`, `.tab-panel`) is constrained to `max-width:540px` and centered. The banner looks disconnected — wider than the rest of the page.

**Files:**
- Modify: `apps/web/public/app.html` (~L210–220, responsive CSS block)

**Interfaces:**
- Consumes: nothing — pure CSS fix
- Produces: nothing — visual alignment only

- [ ] **Step 1: Find the responsive max-width CSS block**

```bash
grep -n "max-width.*540px\|.app-header.*tab-bar\|@media.*640\|@media.*860\|@media.*1100" apps/web/public/app.html | head -10
```

Expected output shows lines ~209–220 with `.tab-panel{...max-width:540px}` and two `@media` blocks.

- [ ] **Step 2: Add `#tier-banner` to each max-width selector**

Find these three CSS declarations (approximately lines 209–220):

```css
.tab-panel{display:none;max-width:540px;margin:0 auto;padding:16px 14px}
```
```css
  .app-header, .tab-bar { max-width: 540px; margin: 0 auto; }
```
```css
  .tab-panel, .app-header, .tab-bar { max-width: 860px; }
```
```css
  .tab-panel, .app-header, .tab-bar { max-width: 1100px; }
```

Change the three media query lines to include `#tier-banner`:

```css
  .app-header, .tab-bar, #tier-banner { max-width: 540px; margin: 0 auto; }
```
```css
  .tab-panel, .app-header, .tab-bar, #tier-banner { max-width: 860px; }
```
```css
  .tab-panel, .app-header, .tab-bar, #tier-banner { max-width: 1100px; }
```

Do NOT change the base `.tab-panel` rule (line ~209) — it already doesn't include `#tier-banner`.

- [ ] **Step 3: Verify (manual)**

Open app on desktop (width > 640px). When logged in as a trial user, the trial banner should be the same width as the tab bar below it — no wider.

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/app.html
git commit -m "fix: constrain trial banner width to match page content on desktop"
```

---

## Task 2: Dynamic Shipping Hint Text

**Problem:** The fee hint line under the "Run Profit Scanner" button always says "Buyer pays shipping" regardless of the user's shipping setting. If the user sets shipping to `seller` or `free`, the hint is wrong.

**Files:**
- Modify: `apps/web/public/app.html` (~L5534–5537, `updateFeeHint` function)

**Interfaces:**
- Consumes: `S.shipping` (string: `'buyer'` | `'seller'` | `'free'`), `S.shipCost` (number), `S.ebayFee` (number), `S.pkgCost` (number)
- Produces: updates `#hint-fee-line` text content

- [ ] **Step 1: Find `updateFeeHint`**

```bash
grep -n "updateFeeHint\|hint-fee-line\|Buyer pays shipping" apps/web/public/app.html | head -10
```

Expected: line ~5534 `function updateFeeHint()`, line ~5536 `el.textContent = \`${S.ebayFee}% eBay fee...`

- [ ] **Step 2: Replace the shipping label in `updateFeeHint`**

Find (line ~5536):
```javascript
  if (el) el.textContent = `${S.ebayFee}% eBay fee · $${parseFloat(S.pkgCost).toFixed(2)} packaging · Buyer pays shipping`;
```

Replace with:
```javascript
  const shipLabel = S.shipping === 'seller' ? `Seller pays $${parseFloat(S.shipCost||6).toFixed(2)} shipping` : S.shipping === 'free' ? 'Free shipping included' : 'Buyer pays shipping';
  if (el) el.textContent = `${S.ebayFee}% eBay fee · $${parseFloat(S.pkgCost).toFixed(2)} packaging · ${shipLabel}`;
```

- [ ] **Step 3: Verify**

Go to Settings → set Shipping to "Seller pays". Save. Return to scanner. The hint line should now say "Seller pays $6.00 shipping" (or whatever `S.shipCost` is).

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/app.html
git commit -m "fix: make shipping hint dynamic based on user shipping setting"
```

---

## Task 3: Fix Shelf Scan Image MIME Type

**Problem:** When a user uploads a PNG for shelf scan, the edge function always tells Anthropic `media_type: 'image/jpeg'` — but Anthropic validates this and returns: `"The image was specified using the image/jpeg media type, but the image appears to be a image/png image"`. Fix: detect the real MIME type from the uploaded file and pass it through.

**Files:**
- Modify: `supabase/functions/claude-proxy/index.ts` (~L129–159, `callAnthropic`; ~L1152–1168, multipart handler)

**Interfaces:**
- Consumes: `imageFile` (File object from multipart form), `imageFile.type` (MIME string like `'image/png'`)
- Produces: correct `media_type` in Anthropic API call

- [ ] **Step 1: Detect MIME from magic bytes (helper function)**

Find the `callAnthropic` function at line ~129. Before it, add a helper that sniffs the true MIME type from the first bytes of the buffer — this is the ground truth since `File.type` can be wrong or absent:

```typescript
function detectImageMime(buf: ArrayBuffer): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const b = new Uint8Array(buf, 0, 12);
  if (b[0] === 0xFF && b[1] === 0xD8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[4] === 0x57 && b[5] === 0x45 && b[6] === 0x42 && b[7] === 0x50) return 'image/webp';
  return 'image/jpeg'; // fallback
}
```

- [ ] **Step 2: Add `mimeType` parameter to `callAnthropic`**

Find the `callAnthropic` signature at line ~129:
```typescript
async function callAnthropic(
  key: string, system: string, images: string[], maxTokens = 1024,
): Promise<string> {
```

Change to accept a mime types array:
```typescript
async function callAnthropic(
  key: string, system: string, images: string[], maxTokens = 1024,
  mimeTypes: ('image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')[] = [],
): Promise<string> {
```

Update the `imageBlocks` mapping inside `callAnthropic` (line ~132–135):
```typescript
  const imageBlocks = images.map((data, i) => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: (mimeTypes[i] ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data },
  }));
```

- [ ] **Step 3: Pass MIME type through handleSingleScan and handleShelfScan**

Find `handleSingleScan` (line ~200):
```typescript
async function handleSingleScan(
  supabase: ReturnType<typeof createClient>, anthropicKey: string, userId: number, settings: Settings,
  images: string[],
```
Add `mimeTypes` parameter:
```typescript
async function handleSingleScan(
  supabase: ReturnType<typeof createClient>, anthropicKey: string, userId: number, settings: Settings,
  images: string[], mimeTypes: string[] = [],
```
Inside, pass it to `callAnthropic`:
```typescript
  const raw = await callAnthropic(anthropicKey, buildSinglePrompt(settings), images, undefined, mimeTypes as ('image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')[]);
```

Do the same for `handleShelfScan` (line ~238):
```typescript
async function handleShelfScan(
  supabase: ReturnType<typeof createClient>, anthropicKey: string, userId: number, settings: Settings,
  images: string[], mimeTypes: string[] = [],
```
Inside:
```typescript
  const raw = await callAnthropic(anthropicKey, buildShelfPrompt(settings), images, 2048, mimeTypes as ('image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')[]);
```

- [ ] **Step 4: Extract MIME in multipart handler and pass through body**

Find the multipart handler at line ~1152–1168:
```typescript
  if (contentType.includes('multipart/form-data')) {
    try {
      const form = await req.formData();
      const imageFile = form.get('image') as File | null;
      const b64 = imageFile ? ab2b64(await imageFile.arrayBuffer()) : '';
      body = {
        type: form.get('type') as string,
        hint: form.get('hint') as string | null,
        imageBase64: b64,
        images: b64 ? [b64] : [],
      };
```

Replace with:
```typescript
  if (contentType.includes('multipart/form-data')) {
    try {
      const form = await req.formData();
      const imageFile = form.get('image') as File | null;
      let b64 = '';
      let imageMime: string = 'image/jpeg';
      if (imageFile) {
        const buf = await imageFile.arrayBuffer();
        b64 = ab2b64(buf);
        imageMime = detectImageMime(buf);
      }
      body = {
        type: form.get('type') as string,
        hint: form.get('hint') as string | null,
        imageBase64: b64,
        images: b64 ? [b64] : [],
        imageMimeTypes: b64 ? [imageMime] : [],
      };
```

- [ ] **Step 5: Use imageMimeTypes when dispatching scan handlers**

Find the routing block at lines ~1222–1234:
```typescript
    if (body.type === 'single_scan') {
      ...
      return json(await handleSingleScan(supabase, anthropicKey, dbUser.id, dbUser.settings, imgs));
    }
    if (body.type === 'shelf_scan') {
      ...
      return json(await handleShelfScan(supabase, anthropicKey, dbUser.id, dbUser.settings, imgs));
    }
```

Change to:
```typescript
    if (body.type === 'single_scan') {
      if (!anthropicKey) return json({ error: 'AI service not configured' }, 503);
      const imgs = Array.isArray(body.images) ? (body.images as string[])
        : body.imageBase64 ? [body.imageBase64 as string] : [];
      if (imgs.length === 0) return json({ error: 'No image provided' }, 400);
      const mimes = Array.isArray(body.imageMimeTypes) ? (body.imageMimeTypes as string[]) : [];
      return json(await handleSingleScan(supabase, anthropicKey, dbUser.id, dbUser.settings, imgs, mimes));
    }
    if (body.type === 'shelf_scan') {
      if (!anthropicKey) return json({ error: 'AI service not configured' }, 503);
      const imgs = Array.isArray(body.images) ? (body.images as string[])
        : body.imageBase64 ? [body.imageBase64 as string] : [];
      if (imgs.length === 0) return json({ error: 'No image provided' }, 400);
      const mimes = Array.isArray(body.imageMimeTypes) ? (body.imageMimeTypes as string[]) : [];
      return json(await handleShelfScan(supabase, anthropicKey, dbUser.id, dbUser.settings, imgs, mimes));
    }
```

- [ ] **Step 6: Deploy and verify**

```bash
cd /home/user/scanforprofit
npx supabase functions deploy claude-proxy --project-ref dqgfpchkheznvanfgsmx
```

Test: upload a PNG to shelf scan. Should no longer get the MIME type error.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/claude-proxy/index.ts
git commit -m "fix: detect real image MIME type for shelf/single scan — stops PNG→JPEG mismatch error"
```

---

## Task 4: Rename "Scanner" Tab to "Profit Scanner"

**Problem:** The Scanner tab label says "Scanner" but should say "Profit Scanner" to match the scanner heading inside the tab (`<h1>Profit Scanner`) and to align with the product's naming ("Profit Scanner", "Profit Compass", "Profit Hub").

**Files:**
- Modify: `apps/web/public/app.html` (~L1169, tab bar button)

**Interfaces:**
- Consumes: nothing
- Produces: updated tab label

- [ ] **Step 1: Find the Scanner tab button**

```bash
grep -n "tab-sourcing\|>Scanner<\|>Profit Scanner<" apps/web/public/app.html | head -5
```

Expected: line ~1169 with `id="tab-sourcing"` and text `Scanner`

- [ ] **Step 2: Update the label text**

Find (line ~1169):
```html
  <button class="tab-btn active" id="tab-sourcing" onclick="switchTab('sourcing')"><span class="t-icon">...</span>Scanner</button>
```

Change only the text node at the end from `Scanner` to `Profit Scanner`. The `id`, `class`, and `onclick` must NOT change. The SVG icon inside `<span class="t-icon">` must NOT change.

The change is ONLY the text after `</span>`:
- Before: `</span>Scanner</button>`
- After: `</span>Profit Scanner</button>`

- [ ] **Step 3: Verify**

Open app. Bottom tab bar should show "Profit Scanner" as the first tab. Clicking it still works. No other tab labels changed.

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/app.html
git commit -m "fix: rename Scanner tab to Profit Scanner"
```

---

## Task 5: Import eBay Orders CSV as Sold Items

**Problem 1:** When a user uploads an eBay orders CSV (Seller Hub → Orders → Download), the app rejects it with "not importable here." But users NEED this flow — it's how they load their sold history when the eBay API sync returns 0.

**Problem 2:** When importing eBay active listings CSV (from Seller Hub → Active Listings → Download), items are imported with status `Unlisted` instead of `Listed`.

**Files:**
- Modify: `apps/web/public/app.html` (~L7661–7672, `handleCsvImport`, eBay order CSV detection block; ~L7705, eBay draft item import with no status)

**Interfaces:**
- Consumes: `parseCsvRows(text)` → `string[][]`, `normaliseImportItem(raw)` → item object, `showImportPreview(items, skippedCount, type)`
- Produces: creates Sold inventory items from eBay orders CSV; creates Listed items from eBay active listings CSV

**eBay Orders CSV column headers (Seller Hub export):** `Order number`, `Buyer name`, `Buyer username`, `Sales record number`, `Transaction ID`, `Item number`, `Item title`, `Custom label`, `Quantity`, `Sale price`, `Shipping and handling`, `Seller collected tax`, `FVF (eBay fees)`, `Total price`, `Payment date`, `Paid on date`, `Shipped on date`, `Feedback left`, `Feedback received`, `Notes to yourself`, `PayPal transaction ID`, `Sold via promoted listings`

**eBay Active Listings CSV column headers:** `Item number`, `Title`, `Start price`, `Buy It Now price`, `Quantity`, `Quantity sold`, `Watchers`, `Bids`, `Views`, `Days active`, `Item URL`, `Custom label`, `Gallery URL`

- [ ] **Step 1: Locate the eBay order CSV detection block**

```bash
grep -n "isEbayOrderCsv\|ebayOrderHeaders\|not importable here\|Use Sync eBay" apps/web/public/app.html
```

Expected: lines ~7661–7671 — the detection block and rejection toast.

- [ ] **Step 2: Replace the rejection with actual parsing (eBay Orders CSV)**

Find this block (lines ~7661–7672):
```javascript
      // Detect eBay order/shipping CSV (Seller Hub Orders export — not importable)
      // Check first 3 rows in case first row is blank
      const ebayOrderHeaders = ['order number','buyer name','buyer username','sales record number','transaction id','ship to name'];
      const firstHeader = rows[0].map(h => h.trim().toLowerCase());
      const isEbayOrderCsv = rows.slice(0, 3).some(row => {
        const rowLower = row.map(h => h.trim().toLowerCase());
        return ebayOrderHeaders.filter(h => rowLower.includes(h)).length >= 2;
      });
      if (isEbayOrderCsv) {
        showToast('This is an eBay orders export — not importable here. Use Sync eBay Listings to import orders.');
        return;
      }
```

Replace with:
```javascript
      // Detect eBay order CSV (Seller Hub Orders export) — parse it as Sold items
      const ebayOrderHeaders = ['order number','buyer name','buyer username','sales record number','transaction id','ship to name'];
      const firstHeader = rows[0].map(h => h.trim().toLowerCase());
      const isEbayOrderCsv = rows.slice(0, 3).some(row => {
        const rowLower = row.map(h => h.trim().toLowerCase());
        return ebayOrderHeaders.filter(h => rowLower.includes(h)).length >= 2;
      });
      if (isEbayOrderCsv) {
        // Find header row (first row with 'item title' or 'order number')
        let hIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          const rh = rows[i].map(h => h.trim().toLowerCase());
          if (rh.some(h => h.includes('item title') || h.includes('order number'))) { hIdx = i; break; }
        }
        if (hIdx === -1) { showToast('Could not parse eBay orders CSV — header row not found'); return; }
        const oh = rows[hIdx].map(h => h.trim().toLowerCase());
        const colTitle  = oh.findIndex(h => h.includes('item title'));
        const colSku    = oh.findIndex(h => h === 'custom label' || h.includes('custom label'));
        const colPrice  = oh.findIndex(h => h === 'sale price' || h.includes('sale price'));
        const colDate   = oh.findIndex(h => h.includes('paid on date') || h.includes('payment date') || h.includes('shipped on date'));
        const colItemNo = oh.findIndex(h => h === 'item number' || h.includes('item number'));
        const existingSkus = new Set(items.map(i => i.sku).filter(Boolean));
        let skippedCount = 0;
        const parsed = [];
        for (let i = hIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row.some(c => c.trim())) continue;
          const title    = colTitle  >= 0 ? (row[colTitle]  || '').trim() : '';
          const sku      = colSku    >= 0 ? (row[colSku]    || '').trim() : '';
          const priceStr = colPrice  >= 0 ? (row[colPrice]  || '').trim() : '';
          const dateStr  = colDate   >= 0 ? (row[colDate]   || '').trim() : '';
          const itemNo   = colItemNo >= 0 ? (row[colItemNo] || '').trim() : '';
          if (!title && !itemNo) continue;
          const soldPrice = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
          // Use item number as SKU fallback to avoid dupes across order rows
          const effectiveSku = sku || (itemNo ? 'ebay-' + itemNo : '');
          if (effectiveSku && existingSkus.has(effectiveSku)) { skippedCount++; continue; }
          parsed.push(normaliseImportItem({
            nickname:     title || ('eBay item ' + itemNo),
            sku:          effectiveSku,
            platform:     'eBay',
            status:       'Sold',
            sellPrice:    soldPrice ? String(soldPrice) : '',
            soldPrice:    soldPrice ? String(soldPrice) : '',
            sold_at:      dateStr || new Date().toISOString(),
            ebay_item_id: itemNo || null,
            created_from: 'ebay_orders_csv',
          }));
          if (effectiveSku) existingSkus.add(effectiveSku);
        }
        if (!parsed.length) { showToast(skippedCount ? `All ${skippedCount} orders already in inventory` : 'No orders found in eBay CSV'); return; }
        pendingImportItems = parsed;
        showImportPreview(pendingImportItems, skippedCount, 'csv');
        return;
      }
```

- [ ] **Step 3: Fix eBay active listings CSV import status**

Find (line ~7705, inside the `if (isEbayDraft)` block):
```javascript
          parsed.push(normaliseImportItem({ nickname: title, sku, sellPrice: String(price), notes: desc, photos: photo ? [photo] : [], image_url: photo || null, created_from: 'ebay_csv' }));
```

Change to add `status: 'Listed'`:
```javascript
          parsed.push(normaliseImportItem({ nickname: title, sku, sellPrice: String(price), notes: desc, photos: photo ? [photo] : [], image_url: photo || null, created_from: 'ebay_csv', status: 'Listed' }));
```

- [ ] **Step 4: Also add `soldPrice` and `sold_at` fields to `normaliseImportItem`**

Find `normaliseImportItem` (line ~7779):
```javascript
function normaliseImportItem(raw) {
  const cat = CATEGORIES.includes(raw.category) ? raw.category : migrateCategory(raw.category);
  const cond = CONDITIONS.includes(raw.condition) ? raw.condition : 'Good';
  const status = ['Unlisted','Listed','Sold'].includes(raw.status) ? raw.status : 'Unlisted';
  const newId = raw.id && !items.find(i => i.id === raw.id) ? raw.id : Date.now() + Math.floor(Math.random()*10000);
  const newSku = raw.sku || generateSku(cat);
  return {
    id:           newId,
    sku:          newSku,
    nickname:     raw.nickname || raw.title || raw.name || 'Unnamed Item',
    category:     cat,
    condition:    cond,
    dateAcquired: raw.dateAcquired || new Date().toISOString().split('T')[0],
    platform:     raw.platform || 'eBay',
    cost:         String(parseFloat(raw.cost)||0),
    sellPrice:    raw.sellPrice || raw.estimated_value ? String(parseFloat(raw.sellPrice||raw.estimated_value)||0) : '',
    status:       status,
    notes:        raw.notes || '',
    photos:       raw.photos || [],
    image_url:    raw.image_url || null,
    createdAt:    raw.createdAt || new Date().toISOString(),
    created_from: raw.created_from || 'import',
  };
}
```

Add `soldPrice`, `sold_price`, `sold_at`, `ebay_item_id` to the returned object:
```javascript
function normaliseImportItem(raw) {
  const cat = CATEGORIES.includes(raw.category) ? raw.category : migrateCategory(raw.category);
  const cond = CONDITIONS.includes(raw.condition) ? raw.condition : 'Good';
  const status = ['Unlisted','Listed','Sold'].includes(raw.status) ? raw.status : 'Unlisted';
  const newId = raw.id && !items.find(i => i.id === raw.id) ? raw.id : Date.now() + Math.floor(Math.random()*10000);
  const newSku = raw.sku || generateSku(cat);
  return {
    id:           newId,
    sku:          newSku,
    nickname:     raw.nickname || raw.title || raw.name || 'Unnamed Item',
    category:     cat,
    condition:    cond,
    dateAcquired: raw.dateAcquired || new Date().toISOString().split('T')[0],
    platform:     raw.platform || 'eBay',
    cost:         String(parseFloat(raw.cost)||0),
    sellPrice:    raw.sellPrice || raw.estimated_value ? String(parseFloat(raw.sellPrice||raw.estimated_value)||0) : '',
    status:       status,
    notes:        raw.notes || '',
    photos:       raw.photos || [],
    image_url:    raw.image_url || null,
    createdAt:    raw.createdAt || new Date().toISOString(),
    created_from: raw.created_from || 'import',
    soldPrice:    raw.soldPrice ? String(parseFloat(raw.soldPrice)||0) : (status === 'Sold' && raw.sellPrice ? String(parseFloat(raw.sellPrice)||0) : undefined),
    sold_price:   raw.soldPrice ? parseFloat(raw.soldPrice)||null : null,
    sold_at:      raw.sold_at || (status === 'Sold' ? new Date().toISOString() : undefined),
    ebay_item_id: raw.ebay_item_id || null,
  };
}
```

- [ ] **Step 5: Update import panel description to mention orders CSV**

Find (line ~1872, inside `panel-import`):
```html
      <p style="font-size:12px;color:var(--muted);line-height:1.7;font-weight:500;margin-bottom:12px">Upload a spreadsheet CSV or an eBay draft listings CSV. Duplicate SKUs are skipped automatically.</p>
```

Change to:
```html
      <p style="font-size:12px;color:var(--muted);line-height:1.7;font-weight:500;margin-bottom:12px">Upload a spreadsheet CSV, eBay active listings CSV, or eBay orders CSV. Orders import as Sold items. Duplicate SKUs are skipped automatically.</p>
```

- [ ] **Step 6: Verify (manual)**

Test with an eBay orders CSV: items should appear in the preview as Sold status.
Test with an eBay active listings CSV: items should appear as Listed status.

- [ ] **Step 7: Commit**

```bash
git add apps/web/public/app.html
git commit -m "fix: parse eBay orders CSV as Sold items; import active listings as Listed"
```

---

## Task 6: Duplicate Item Warning from Scan (confirmBuyItem)

**Problem:** The manual inventory form (`saveInvItem`) already checks for duplicates via `findDuplicateItem()`. But adding an item from a scan result (`confirmBuyItem`) skips this check entirely — so scanning the same item twice creates silent duplicates.

**Files:**
- Modify: `apps/web/public/app.html` (~L6387–6425, `confirmBuyItem`)

**Interfaces:**
- Consumes: `findDuplicateItem(name, null)` → existing item or null; `name` from `document.getElementById('bc-name').value`
- Produces: `confirm()` dialog if duplicate found; proceeds or cancels

- [ ] **Step 1: Find `confirmBuyItem`**

```bash
grep -n "function confirmBuyItem" apps/web/public/app.html
```

Expected: line ~6387.

- [ ] **Step 2: Add duplicate check after name extraction**

Find in `confirmBuyItem` (line ~6390–6395):
```javascript
  const name     = document.getElementById('bc-name').value.trim() || item.item_name;
  const category = document.getElementById('bc-category').value;
  const condition= document.getElementById('bc-condition').value;
  const cost     = parseFloat(document.getElementById('bc-cost').value)||0;
  const sellPrice= parseFloat(document.getElementById('bc-price').value)||0;
  const notes    = document.getElementById('bc-notes').value;
  // Photos always start empty...
```

After the `notes` line and before the `logScan` call (line ~6402), insert:
```javascript
  // Duplicate check — same as manual add form
  const dupItem = findDuplicateItem(name, null);
  if (dupItem) {
    const proceed = confirm(
      `"${dupItem.nickname}" already exists in ${dupItem.status}.\n\nAdd it again anyway?`
    );
    if (!proceed) return;
  }
```

- [ ] **Step 3: Verify**

Scan an item that's already in inventory. In the Buy Confirm modal, click "Add to Inventory." A browser confirm dialog should appear: `"[Item name]" already exists in [status]. Add it again anyway?`

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/app.html
git commit -m "fix: add duplicate item warning when adding from scan result"
```

---

## Task 7: Remove.bg Key Visibility — Add Hint in Photos Tab

**Problem:** The remove.bg API key field exists in Settings (Scanner tab → Settings → Photo Tools). But users look for it in the Photos tab since that's where "Remove BG" button lives. Add a visible note in the Photos tab pointing to where the key lives.

**Files:**
- Modify: `apps/web/public/app.html` (~L1674–1675, Photos tab remove.bg button area)

**Interfaces:**
- Consumes: nothing — UI text change only
- Produces: updated hint text next to Remove BG button

- [ ] **Step 1: Find the remove.bg button in the Photos tab**

```bash
grep -n "pa-removebg-btn\|Remove BG\|Needs remove.bg key" apps/web/public/app.html | head -10
```

Expected: lines ~1674–1675.

- [ ] **Step 2: Update the hint text**

Find (line ~1675):
```html
          <span class="text-xs-muted">Needs remove.bg key in Settings</span>
```

Change to:
```html
          <span class="text-xs-muted">Needs remove.bg key — add it in <button onclick="showSourcingSettings()" style="background:none;border:none;color:var(--accent);font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;padding:0;text-decoration:underline">Scanner → Settings → Photo Tools</button></span>
```

- [ ] **Step 3: Verify**

Open Photos tab. The "Remove BG" button area now shows a link "Scanner → Settings → Photo Tools" that opens the settings panel directly.

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/app.html
git commit -m "fix: add direct link to remove.bg key location from Photos tab"
```

---

## Task 8: Fix Profit Hub — Show New Dashboard, Not Old P&L

**Problem:** When the user clicks "Profit Hub" tab, `switchTab('dashboard')` calls `statsSubTab('pnl')` which shows `#stats-view-pnl` (old dashboard: Revenue + Net Profit KPI cards, basic sales list). The new Profit Hub dashboard exists in `#stats-view-dash` (rendered by `renderDashboard()`) with 6 KPIs, expense tracker, trend charts, category breakdown, top performers — but it's never shown because `statsSubTab` always hides it.

**Files:**
- Modify: `apps/web/public/app.html` (~L7948–7961, `statsSubTab`; ~L2520, switchTab dashboard handler; ~L1914–1916, sub-tab buttons)

**Interfaces:**
- Consumes: `renderDashboard()` (populates `#dash-content`), `renderSubscriptionPanel()`, `sPnlRender()` (old, keep for fallback)
- Produces: clicking "Profit Hub" tab shows new 6-KPI dashboard; clicking "Expenses" sub-tab shows expense add form; clicking "Plan" sub-tab shows subscription panel

- [ ] **Step 1: Understand current tab HTML structure**

```bash
grep -n "stats-sub-pnl\|stats-sub-subscription\|stats-view-dash\|stats-view-pnl\|stats-view-subscription\|statsSubTab" apps/web/public/app.html | head -20
```

Expected: sub-tab buttons at ~L1914–1916; view divs at ~L1918, 1925; `statsSubTab` at ~L7948.

- [ ] **Step 2: Rename the P&L sub-tab button to "Dashboard"**

Find (line ~1915):
```html
    <button class="filter-btn active" id="stats-sub-pnl" onclick="statsSubTab('pnl')">P&amp;L</button>
```

Change to:
```html
    <button class="filter-btn active" id="stats-sub-pnl" onclick="statsSubTab('pnl')">Dashboard</button>
```

Find (line ~1916):
```html
    <button class="filter-btn" id="stats-sub-subscription" onclick="statsSubTab('subscription')">Plan</button>
```

Add an "Expenses" button between Dashboard and Plan:
```html
    <button class="filter-btn" id="stats-sub-expenses" onclick="statsSubTab('expenses')">Expenses</button>
    <button class="filter-btn" id="stats-sub-subscription" onclick="statsSubTab('subscription')">Plan</button>
```

- [ ] **Step 3: Rewrite `statsSubTab` to route 'pnl' to the new dashboard**

Find `statsSubTab` (line ~7948):
```javascript
function statsSubTab(sub) {
  var dash = document.getElementById('stats-view-dash');
  var pnl  = document.getElementById('stats-view-pnl');
  var subv = document.getElementById('stats-view-subscription');
  var bpnl  = document.getElementById('stats-sub-pnl');
  var bsub  = document.getElementById('stats-sub-subscription');
  if(dash) dash.style.display = 'none';
  if(pnl)  pnl.style.display  = sub==='pnl'?'block':'none';
  if(subv) subv.style.display = sub==='subscription'?'block':'none';
  if(bpnl)  bpnl.classList.toggle('active', sub==='pnl');
  if(bsub)  bsub.classList.toggle('active', sub==='subscription');
  if(sub==='pnl') { sPnlRender(); sPnlTab('sales'); }
  if(sub==='subscription') renderSubscriptionPanel();
}
```

Replace with:
```javascript
function statsSubTab(sub) {
  var dash = document.getElementById('stats-view-dash');
  var pnl  = document.getElementById('stats-view-pnl');
  var subv = document.getElementById('stats-view-subscription');
  var bpnl  = document.getElementById('stats-sub-pnl');
  var bexp  = document.getElementById('stats-sub-expenses');
  var bsub  = document.getElementById('stats-sub-subscription');
  // Hide all views first
  if(dash) dash.style.display = 'none';
  if(pnl)  pnl.style.display  = 'none';
  if(subv) subv.style.display = 'none';
  // Toggle active state on buttons
  if(bpnl)  bpnl.classList.toggle('active', sub==='pnl');
  if(bexp)  bexp.classList.toggle('active', sub==='expenses');
  if(bsub)  bsub.classList.toggle('active', sub==='subscription');
  // Show correct view
  if(sub==='pnl') {
    if(dash) dash.style.display = 'block';
    renderDashboard();
  }
  if(sub==='expenses') {
    if(pnl) pnl.style.display = 'block';
    sPnlRender(); sPnlTab('exp');
  }
  if(sub==='subscription') {
    if(subv) subv.style.display = 'block';
    renderSubscriptionPanel();
  }
}
```

- [ ] **Step 4: Update switchTab to use 'pnl' (which now shows new dashboard)**

Find (line ~2597):
```javascript
  if (tab === 'dashboard') { statsSubTab('pnl'); }
```

This is already correct — `statsSubTab('pnl')` will now show the new dashboard. No change needed here.

- [ ] **Step 5: Verify the new dashboard renders on tab switch**

Also check that `renderDashboard` is called on login. Find the login success handler:
```bash
grep -n "renderDashboard\(\)" apps/web/public/app.html | head -5
```

Expected: at least one call at ~L2520. If it's there, the dashboard loads on login. Good.

- [ ] **Step 6: Verify (manual)**

Click "Profit Hub" tab. Should show: "Dashboard" sub-tab active, 6 KPI cards (Total Sales, Total Costs, Total Fees, Net Profit, Margin, ROI), Expense Tracker section, trend charts, category breakdown. Clicking "Expenses" sub-tab shows the expense add form and mileage logger. Clicking "Plan" shows subscription panel.

- [ ] **Step 7: Commit**

```bash
git add apps/web/public/app.html
git commit -m "fix: Profit Hub tab now shows new dashboard with 6 KPIs and charts; Expenses moved to sub-tab"
```

---

## Task 9: eBay Sync — Better Diagnostics and Re-auth Prompt

**Problem:** The "Sync eBay Listings" and "Sync Sold Orders" buttons return 0 results. Root causes: (A) if the eBay token was granted before `sell.fulfillment` scope was added to `EBAY_SCOPES`, orders won't be returned; (B) the Inventory API only returns listings created via the API — listings created through eBay's normal UI don't appear. Add diagnostics to show what's actually happening, and prompt re-auth if scope is likely missing.

**Files:**
- Modify: `supabase/functions/ebay-oauth/index.ts` (`handleSyncOrders`, `handlePullListings`)
- Modify: `apps/web/public/app.html` (~L5282–5335, `ebayPullListings`; ~L8059–8066, ebay sync panel)

**Interfaces:**
- Consumes: eBay API responses from `sell.fulfillment/v1/order` and `sell/inventory/v1/offer`
- Produces: `{ active, drafted, sold, debug: { ordersFound, apiStatus, hasScope } }` in pull-listings response

- [ ] **Step 1: Add debug output to `handleSyncOrders` in edge function**

Find `handleSyncOrders` in `supabase/functions/ebay-oauth/index.ts` (line ~513). After `const { orders = [] } = await ordersRes.json()...`, add:

```typescript
  const ordersFound = orders.length;
  console.log(`handleSyncOrders: userId=${userId} ordersFound=${ordersFound}`);
```

Change the final return to include debug:
```typescript
  return json({ synced, debug: { ordersFound, ordersApiStatus: ordersRes.status } });
```

- [ ] **Step 2: Add debug output to `handlePullListings`**

At the end of `handlePullListings` (line ~390), change:
```typescript
  return json({ active, drafted, sold });
```
to:
```typescript
  return json({ active, drafted, sold, debug: { totalOffers: active + drafted, totalOrders: sold } });
```

- [ ] **Step 3: Show diagnostic info in the sync panel UI**

Find `ebayPullListings` (line ~5272). After successful sync, change the success message:

Find:
```javascript
    st.style.color='var(--green)';
    const total = d.active + d.drafted + d.sold;
    st.innerHTML=`Synced ${total} items<br>${d.active} active, ${d.drafted} drafts, ${d.sold} sold`;
```

Change to:
```javascript
    st.style.color='var(--green)';
    const total = d.active + d.drafted + d.sold;
    let syncMsg = `Synced ${total} items — ${d.active} active, ${d.drafted} drafts, ${d.sold} sold`;
    if (total === 0) {
      st.style.color = 'var(--yellow)';
      syncMsg = `0 items returned from eBay. If you have listings on eBay, disconnect and reconnect eBay to refresh your authorization (Settings → eBay). eBay's Inventory API only shows listings created via API.`;
    }
    st.innerHTML = syncMsg;
```

Find `handleSyncOrders` in app.html (line ~5363). After checking `res.ok`, update the success display:

Find:
```javascript
    if (st) { st.style.color = 'var(--green)'; st.textContent = '' + data.synced + ' sold order' + (data.synced === 1 ? '' : 's') + ' synced'; }
```

Change to:
```javascript
    if (data.synced === 0 && data.debug && data.debug.ordersFound === 0) {
      if (st) { st.style.color = 'var(--yellow)'; st.textContent = '0 orders found. If you have eBay sales, try disconnecting and reconnecting eBay to refresh the Fulfillment scope.'; }
    } else {
      if (st) { st.style.color = 'var(--green)'; st.textContent = '' + data.synced + ' sold order' + (data.synced === 1 ? '' : 's') + ' synced'; }
    }
```

- [ ] **Step 4: Add "Reconnect eBay" button to the sync panel**

Find the ebay sync panel (line ~8059):
```html
<div id="ebay-sync-panel" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9000;align-items:flex-end;justify-content:center;flex-direction:column">
```

Find the close/bottom section of the sync panel. After the `sync-orders-btn` button (line ~8065), add a reconnect note:
```html
<div style="font-size:10px;color:var(--muted);font-family:'IBM Plex Mono',monospace;text-align:center;padding:4px 0 8px">Getting 0 results? <button onclick="closeEbaySync();showSourcingSettings();" style="background:none;border:none;color:var(--accent);font-family:'IBM Plex Mono',monospace;font-size:10px;cursor:pointer;text-decoration:underline;padding:0">Disconnect &amp; reconnect eBay</button> in Settings</div>
```

- [ ] **Step 5: Deploy edge function**

```bash
cd /home/user/scanforprofit
npx supabase functions deploy ebay-oauth --project-ref dqgfpchkheznvanfgsmx
```

- [ ] **Step 6: Verify**

Click "Sync eBay Listings." If 0 results, yellow warning message appears with reconnect instructions. If results found, green success message.

- [ ] **Step 7: Commit**

```bash
git add apps/web/public/app.html supabase/functions/ebay-oauth/index.ts
git commit -m "fix: add eBay sync diagnostics and reconnect prompt when 0 results returned"
```

---

## Final Push

```bash
git push -u origin claude/cool-rubin-mka6bv
```

---

## Spec Coverage Checklist

| Bug | Task |
|-----|------|
| Trial bar too wide | Task 1 |
| "Buyer pays shipping" always shown | Task 2 |
| Shelf scan PNG MIME error | Task 3 |
| "Scanner" tab rename | Task 4 |
| eBay orders CSV rejected | Task 5 |
| Active listings import as Unlisted | Task 5 |
| Duplicate item warning missing from scan | Task 6 |
| remove.bg key hard to find | Task 7 |
| Profit Hub shows old dashboard | Task 8 |
| eBay sync returns 0 with no explanation | Task 9 |
