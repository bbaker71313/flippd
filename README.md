# Flippd — AI Sourcing OS for Resellers

[![GitHub stars](https://img.shields.io/github/stars/bbaker71313/flippd?style=social)](https://github.com/bbaker71313/flippd)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)

> Scan a shelf. Get a FLIP or PASS decision in 8 seconds. Know your profit math before you buy.

Flippd is the all-in-one sourcing and business tool for solo eBay resellers. Snap a photo of any item or a full shelf at a thrift store and get an instant profitability decision with AI-powered market research, profit calculations, inventory tracking, and P&L analytics — all on your phone.

**[Try it now →](https://flippd.com)** | **[Early Access →](https://flippd.com/early-access)** | **[Learn more →](https://github.com/bbaker71313/flippd/wiki)**

---

## 🎯 What Flippd Does

### The Problem
Resellers spend 2-5 minutes researching each item. At a thrift store with 200 items on a shelf, that doesn't scale. You need a decision in seconds.

### The Solution
**Shelf Scan** — One photo of a full shelf. Every visible item ranked by profit potential (HOT / FLIP / PASS). Nothing else in the market does this.

### Features
- 🔭 **Shelf scan** — Scan 10-20 items from one photo
- 📸 **Single item scan** — Photo or description
- 💰 **Real profit math** — Accounts for eBay fees (configurable), packaging, and costs
- 📦 **Inventory tracking** — Add items, track status, set sell prices
- 📊 **P&L dashboard** — Monthly revenue, expenses, profit, ROI
- 📈 **Market trends** — What's selling this week, hunt lists, stale item alerts
- 🎨 **Photo enhancer** — AI image enhancement for better listings (coming soon)
- ✍️ **Listing generator** — AI-powered eBay titles and descriptions (Phase 2)

---

## 🚀 Quick Start

### For Users
1. **Go to [flippd.com](https://flippd.com)**
2. **Sign up** with your email (magic link auth)
3. **Take a photo** of an item or shelf
4. **Get a decision** in 8 seconds
5. **Upgrade** to Hustle ($19/mo) when you need unlimited scans

### For Developers
1. **Clone the repo:**
   ```bash
   git clone https://github.com/bbaker71313/flippd.git
   cd flippd
   ```

2. **Open frontend:**
   ```bash
   # No build step needed. Just open in browser:
   open Flippd_v5.html
   # Or serve locally:
   python -m http.server 8000
   ```

3. **Start contributing:**
   - Read [GETTING_STARTED.md](./GETTING_STARTED.md)
   - Check [ROADMAP.md](./ROADMAP.md) for what needs building
   - See [CONTRIBUTING.md](./CONTRIBUTING.md) for code style

---

## 📋 Current State

| Feature | Status | Launch |
|---------|--------|--------|
| Single item scan | ✅ Live | v4 |
| Shelf scan | ✅ Live | v4 |
| Inventory tracking | ✅ Live | v4 |
| Profit calculator | ✅ Live | v4 |
| P&L dashboard | ✅ Live | v4 |
| Photo enhancer | ✅ Live | v4 |
| Market trends | ✅ Live | v4 |
| Magic link auth | ✅ Live | Replit backend |
| Stripe subscriptions | ✅ Live | Replit backend |
| Listing generator | 🔲 Coming | Phase 2.1 |
| Cross-listing formatter | 🔲 Coming | Phase 3.4 |
| eBay API sync | 🔲 Coming | Phase 4.2 |

**See [ROADMAP.md](./ROADMAP.md) for full feature timeline and priorities.**

---

## 💾 Tech Stack

### Frontend
- **Language:** HTML5 + Vanilla JavaScript (ES6+)
- **Storage:** localStorage (no build step, no dependencies)
- **Size:** ~9,000 lines, single file
- **Design tokens:** CSS variables (Syne + IBM Plex Mono fonts)

### Backend (Replit)
- **Runtime:** Node.js 16+
- **Framework:** Express.js
- **Auth:** Magic links (Resend)
- **Payments:** Stripe (subscriptions)
- **Database:** Replit DB (key-value, built-in)
- **Proxy:** Routes to Anthropic Claude API (tier-gated scans)

### External Services
- **AI:** Anthropic Claude (claude-sonnet-4-6)
- **Email:** Resend (magic links, transactional)
- **Payments:** Stripe (subscriptions, webhooks)
- **Hosting:** Replit (backend), Vercel/Netlify (frontend)

---

## 🏗️ Architecture

```
Flippd App (Flippd_v5.html)
    ↓ [HTTPS]
Flippd Backend (Node.js / Replit)
    ├─ Magic Link Auth (Resend)
    ├─ JWT Sessions
    ├─ Subscription Management (Stripe)
    ├─ Scan Limits (tier-gated)
    └─ AI Proxy (Anthropic Claude)
```

**Key files:**
- `Flippd_v5.html` — Frontend (all-in-one)
- `backend/index.js` — Express backend
- `CLAUDE.md` — Development guidelines
- `ARCHITECTURE.md` — Detailed system design

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for full details.

---

## 💰 Pricing & Tiers

| Tier | Price | Scans | Items | Features |
|------|-------|-------|-------|----------|
| **Scout** | Free | 25/mo | 10 | Basic scanning, profit calc |
| **Hustle** | $19/mo | ∞ | 500 | Unlimited scans, P&L, export |
| **Stack** | $49/mo | ∞ | ∞ | All features, photo enhance, trends |
| **Empire** | $199/mo | ∞ | ∞ | All + team seats, API access |

**First 500 early access users get 50% off Hustle forever.**

See [BUSINESS.md](./BUSINESS.md) for full business model and unit economics.

---

## 🤝 Contributing

We welcome bug reports, feature ideas, and pull requests. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

### Quick Contribution Guide

1. **Find an issue** or identify a bug
2. **Create a branch:** `git checkout -b fix/issue-name`
3. **Test on a mobile device** (critical!)
4. **Commit with clear message:** `git commit -m "[FRONTEND] Fix iOS camera issue"`
5. **Open a PR** with description and screenshots

### Code Style
- **JavaScript:** Camel case, ES6+, no console.logs
- **Comments:** Google-style docstrings on major functions
- **Testing:** Unit tests for critical logic (fees, auth, subscriptions)

See [DECISIONS.md](./DECISIONS.md) for architectural decisions and why certain choices were made.

---

## 📚 Documentation

- **[GETTING_STARTED.md](./GETTING_STARTED.md)** — Setup guide for users and developers
- **[ROADMAP.md](./ROADMAP.md)** — Feature priorities and timeline
- **[BUSINESS.md](./BUSINESS.md)** — Business model, GTM strategy, financials
- **[DECISIONS.md](./DECISIONS.md)** — Why we made certain choices
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — System design and data flow
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — How to contribute
- **[CLAUDE.md](./CLAUDE.md)** — Development rules for Claude sessions

---

## 🐛 Issues & Support

- **Bugs:** [GitHub Issues](https://github.com/bbaker71313/flippd/issues) (use bug template)
- **Features:** [GitHub Issues](https://github.com/bbaker71313/flippd/issues) (use feature template)
- **Questions:** [GitHub Discussions](https://github.com/bbaker71313/flippd/discussions)
- **Security:** Email bbaker71313@gmail.com (don't open public issue)

---

## 📊 Key Metrics

- **Users:** 50+ early access
- **Paid:** 10-15 Hustle tier
- **MRR:** ~$200
- **Scans completed:** 500+ total
- **7-day retention:** 70%+

---

## 🎯 Next Steps

### For Users
- [Sign up for early access](https://flippd.com)
- Try a shelf scan with 10+ items
- Email us feedback

### For Developers
- [Set up local development](./GETTING_STARTED.md#-local-development-setup)
- Pick a [ROADMAP.md](./ROADMAP.md) feature to build
- Submit a PR!

### For Investors / Partners
- Read [BUSINESS.md](./BUSINESS.md)
- Review [financial projections](./BUSINESS.md#financial-projections)
- [Schedule a call](https://calendly.com/bbaker71313)

---

## 📜 License

[MIT License](./LICENSE) — Use freely, attribution appreciated.

---

## 🙏 Acknowledgments

- **Britt Baker** — Founder, solo reseller, built the original MVP
- **Anthropic Claude** — AI model powering scans
- **Reseller community** — Reddit r/Flipping, TikTok, YouTube — where we learned the real problems

---

## 🚀 Status

**Stage:** Early access (May 2026)  
**Team:** Britt (founder) + 1 growth person (hiring) + contributors  
**Goal:** 100+ paying users and product-market fit by October 2026

---

**[Try Flippd →](https://flippd.com)**

Questions? [Open an issue](https://github.com/bbaker71313/flippd/issues) or [email us](mailto:bbaker71313@gmail.com).

Happy flipping! 🎉
