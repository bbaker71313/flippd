# ScanForProfit

**Scan the shelf. Know what to buy.**

ScanForProfit is the AI-powered sourcing and business tool for solo eBay resellers. Take a photo of any item or a whole shelf, get an instant FLIP or PASS with real profit math after fees, and track everything in one app.

## Features

- **AI Sourcing Scanner** — Photo → eBay comps → profit calculation → FLIP/PASS decision (8 seconds)
- **Shelf Scan** — One wide photo of an entire shelf. Every item ranked by profit potential
- **Inventory Tracking** — Every item you own, tracked. Cost, sell price, profit, status
- **P&L Dashboard** — Real revenue, real profit, real expenses. Know exactly what you made
- **Market Trends** — Stale items, best-performing categories, AI-generated hunt list
- **Photo Enhancer** — Clean up photos for better listings

## Get Started

### For Users (Early Access)

1. Go to [flippd.com](https://flippd.com)
2. Enter your early access code (sent via email)
3. Take a photo of any item or a shelf
4. Get your FLIP or PASS decision with profit breakdown

**Full guide:** See [docs/INSTALL.md](docs/INSTALL.md)

### For Developers

1. Clone this repo: `git clone https://github.com/yourusername/ScanForProfit.git`
2. Open `src/app/ScanForProfit_v5.html` in your browser
3. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) to understand how it works
4. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) to deploy your own version

## Technology

- **Frontend:** Vanilla JavaScript + HTML/CSS (single-file app, no build step)
- **Backend:** AI-powered (Claude Sonnet 4.6 API, proxied through custom backend)
- **Storage:** Browser localStorage (all data stays on your device)
- **Mobile:** iOS and Android via web app (responsive design)

## Documentation

- [Install & Run Locally](docs/INSTALL.md) — How to use ScanForProfit on your own machine
- [Deployment Guide](docs/DEPLOYMENT.md) — Deploy to Vercel, Netlify, or your own server
- [Architecture](docs/ARCHITECTURE.md) — How ScanForProfit is built
- [API Integration](docs/API_INTEGRATION.md) — How to wire in a proxy backend
- [Data Model](docs/DATA_MODEL.md) — localStorage schema and calculations
- [Pricing](docs/public/PRICING.md) — Tier comparison and features
- [FAQ](docs/public/FAQ.md) — Common questions and answers
- [Roadmap](docs/public/ROADMAP.md) — What's coming next

## Privacy

Your data stays on your device. ScanForProfit:
- ✅ Stores inventory in your browser (not on servers)
- ✅ Sends only photos to the AI API for scanning
- ✅ Does NOT share data with third parties
- ✅ Allows you to export your data anytime

See [legal/PRIVACY.md](legal/PRIVACY.md) for full details.

## Support

- Questions? Email: support@flippd.com
- Found a bug? Open an [issue](https://github.com/yourusername/ScanForProfit/issues)
- Want to help? See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

ScanForProfit is proprietary software. See [LICENSE](LICENSE) for details.

## Roadmap

**Now (v1.0):** AI scanning, shelf scan, inventory, P&L tracking  
**Coming (v2.0):** Live eBay comps, AI listing generator, cross-listing to Poshmark/Mercari  
**Future (v3.0):** eBay API sync, team features, auto-pricing engine

See [Roadmap](docs/public/ROADMAP.md) for full details.

## About

ScanForProfit is built for solo resellers who source from thrift stores, estate sales, garage sales, and flea markets. It replaces 4+ separate tools (eBay Seller Hub, Google Sheets, scanning apps, spreadsheets) with one integrated app.

**Built by resellers, for resellers.**

---

**Current Version:** 1.0 (Early Access)  
**Status:** In active development  
**Last Updated:** April 28, 2026
