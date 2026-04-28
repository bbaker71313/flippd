# Flippd — AI Reseller Operating System (v5.3)

A mobile-first single-file HTML5 app for solo eBay resellers. Scan shelves with your phone, get instant AI-powered buy/pass decisions, track inventory, generate listings, and monitor profit — all with magic link email auth and subscription tiers.

**Status:** v5.3 — Production Ready with Backend  
**Backend:** https://flippd-backend.replit.app  
**Auth:** Magic links (email) → JWT sessions → Stripe subscriptions  

---

## 🎯 What It Does

**SCOUT** — Scan individual items or entire shelves with your phone camera. AI analyzes product details and estimates profit instantly.

**INVENTORY** — Track everything you've sourced: cost, sell price, status, photos, condition. AI generates professional eBay listings in seconds.

**PHOTOS** — Enhanced photo uploading with AI-powered image processing.

**TRENDS** — Market insights: which items are selling fast, which are stale, what buyers are looking for.

**STATS** — P&L tracking with monthly breakdowns, expense logging, and ROI calculations. Know exactly which categories are most profitable.

---

## ⚡ Quick Start

### Try Now
1. Open Flippd in your browser
2. Enter your email
3. Check email for magic link, click it
4. **Get 7 free days** of unlimited access
5. After trial: Auto-downgrade to Scout tier (25 scans/month, 10 items)

**No credit card required for trial.**

### For Resellers
- Uses your configured eBay fee % (default 13%)
- Works with mixed-category inventory (clothing, electronics, home goods, etc.)
- Supports cross-listing prep (Poshmark, Mercari, Facebook Marketplace coming soon)
- All data synced across sessions (backend + localStorage)

---

## 🚀 Features (v5.3)

### Auth & Accounts (NEW)
- ✅ Magic link email authentication (no passwords)
- ✅ 7-day free trial (unlimited access)
- ✅ Auto-tier downgrade after trial expires
- ✅ JWT session management (90-day expiry)
- ✅ Stripe subscriptions (monthly & annual)
- ✅ Scan limits enforced per tier
- ✅ Inventory limits enforced per tier

### Sourcing (SCOUT tab)
- ✅ Single-item AI analysis — description or photo
- ✅ Shelf scan — rank all items on one shelf instantly  
- ✅ Configurable sourcing strategy (Conservative / Balanced / Aggressive)
- ✅ Scan history with decision logging
- ✅ Profit math includes user-configured eBay fees

### Inventory (INVENTORY tab)
- ✅ Add/edit/delete items with full details
- ✅ Category filtering + search
- ✅ Status tracking (Unlisted → Listed → Sold)
- ✅ Multi-photo support per item
- ✅ Notes and condition tracking

### AI Power Listing (INVENTORY tab)
- ✅ Auto-generate eBay titles (80 char, optimized)
- ✅ AI descriptions (250-400 words, mobile-friendly)
- ✅ Condition-specific notes
- ✅ Unlimited regenerate for variations
- ✅ CSV export for eBay Seller Hub (exact format)
- ✅ Works with 21 eBay leaf categories

### Photo Enhancement (PHOTOS tab)
- ✅ Camera integration (iOS/Android)
- ✅ AI-powered image suggestions
- ✅ Batch enhancement
- ✅ Landscape rotation support

### Market Insights (TRENDS tab)
- ✅ Stale listing alerts (30+ days)
- ✅ Hunt list (AI-suggested categories to scout)
- ✅ Market trends by category
- ✅ Sell-through rates

### P&L Tracking (STATS tab)
- ✅ Revenue by category + monthly breakdown
- ✅ Expense logging (overhead, shipping supplies)
- ✅ Mileage tracker (tax deductible)
- ✅ Profit margin & ROI calculations
- ✅ Interactive charts and KPIs

---

## 💰 Pricing & Tiers

| Tier | Scans/mo | Items | Trial | Cost |
|------|----------|-------|-------|------|
| **Trial** | Unlimited | Unlimited | 7 days | FREE |
| **Scout** | 25 | 10 | After trial | FREE |
| **Hustle** | Unlimited | 500 | N/A | $19/mo or $180/yr |
| **Stack** | Unlimited | Unlimited | N/A | $49/mo or $480/yr |
| **Empire** | Unlimited | Unlimited | N/A | $199/mo (10 seats) |

After trial expires, you automatically downgrade to Scout. No surprise charges, just less features.

---

## 🛠️ Technical Details

### Architecture
- **Single HTML5 file** (~5KB HTML + 300KB JavaScript/CSS)
- **No build step** — works as-is
- **Backend connected** — Magic links, JWT auth, Stripe webhooks
- **Offline-first** — Data cached locally, syncs when online
- **Mobile-optimized** — 540px max-width, dark mode, iOS home screen support
- **AI-powered** — Claude Sonnet 4.6 for analysis and generation

### Storage
- `flippd_items_v1` — inventory items (JSON)
- `fif_api_key` — JWT token (from magic link)
- `fif_settings` — user settings (fees, thresholds, etc.)
- `fef_scan_log` — sourcing history (500 scans max)
- `fif_pnl_expenses` — expense logs

### Data Model

**Item Object:**
```javascript
{
  id: timestamp,
  sku: "ELEC-001",
  nickname: "Sony Handycam",
  category: "Electronics",
  condition: "Good",
  cost: "12.00",
  sellPrice: "45.00",
  status: "Unlisted",
  photos: ["data:image/jpeg;base64,..."],
  listing: {
    title: "Sony CCD-F73 Handycam...",
    description: "Vintage handycam in excellent condition...",
    conditionNote: "Works perfectly, all features tested...",
    ebayCategory: "Amplifiers & Preamps",
    ebayConditionId: "USED_VERY_GOOD",
    generatedAt: "2026-04-27T18:32:14.123Z"
  }
}
```

---

## 🐛 Version History

**v5.3** (Apr 28, 2026) — Backend integration, magic link auth, Stripe subscriptions, tier system
**v5.2** (Apr 27, 2026) — AI Power Listing Generator, CSV export for eBay
**v5.1** (Apr 20, 2026) — Auto-inject API key, persistent instructions
**v5.0** (Apr 15, 2026) — Shelf scan, inventory tracking, P&L dashboard
**v4.0** (Mar 2026) — Initial release

---

## 🗺️ Roadmap

### Phase 2 — Early Access (🔄 Current)
- [x] 2.1 AI Power Listing Generator
- [x] 2.2 Backend integration & subscriptions
- [ ] 2.3 Shareable scan result cards
- [ ] 2.4 Team collaboration

### Phase 3 — Growth (Next)
- [ ] 3.1 Live eBay sold comps (Browse API)
- [ ] 3.2 Max sourcing price calculator
- [ ] 3.3 Shipping cost estimator
- [ ] 3.4 Cross-listing formatter (Poshmark/Mercari)

### Phase 4 — Scale (After Phase 3)
- [ ] 4.1 Team features (multi-seat)
- [ ] 4.2 eBay API sync (auto-sold notifications)
- [ ] 4.3 Auto-pricing engine

---

## 📊 By The Numbers

- **5,054+ lines** of HTML/CSS/JavaScript (single file)
- **21 eBay leaf categories** hardcoded with correct IDs
- **15+ major features** (sourcing, inventory, photos, trends, P&L)
- **500 scan history** limit per session
- **30 activity log** limit (auto-cleanup)
- **500KB image limit** per scan (with quality fallback)
- **Zero dependencies** — no npm, no build, pure vanilla JS

---

## 🔐 Privacy & Data

- **All data stays on your device** — localStorage + backend auth only
- **Backend only has:** Email, JWT, subscription status, scan count
- **Backend doesn't have:** Inventory data, photos, profit math
- **Works offline** — Cache-first, syncs when online
- **Open source** — MIT License, all code visible on GitHub
- **Transparent** — See exactly what's stored where

---

## 📖 Documentation

- `CLAUDE.md` — Development rules & patterns
- `BACKEND_INTEGRATION.md` — Backend API & auth flow
- `ROADMAP.md` — Product vision & feature priorities
- `DECISIONS.md` — Architectural & business decisions
- `CHANGELOG.md` — Version history
- `EBAY_CATEGORIES.md` — All 21 leaf categories with IDs
- `V5.2_IMPLEMENTATION_GUIDE.md` — Technical deep-dive for listings

---

## 🤝 Contributing

Bug reports and feature requests welcome:
- **Bug reports:** GitHub Issues (include screenshots + steps to reproduce)
- **Feature requests:** GitHub Discussions
- **PRs:** Always welcome, especially mobile-responsive fixes and new market data

**Development:**
1. Download `Flippd_v5.html`
2. Edit in your text editor
3. Reload browser to test (no build step)
4. Test on real mobile device if possible
5. Open PR with description

---

## 📝 License

MIT License — Use, modify, distribute freely. Commercial use allowed.

---

## 💬 Get In Touch

- **GitHub:** github.com/bbaker71313/flippd
- **Backend:** https://flippd-backend.replit.app
- **Status:** All systems operational

---

**Made for solo eBay resellers by a solo eBay reseller.**

"Scan the shelf. Know what to buy. Manage like a pro."

