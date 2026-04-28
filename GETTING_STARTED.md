# Getting Started with Flippd

Quick start guide for developers, users, and team members.

---

## For Users (Want to try Flippd?)

### 🚀 Quick Start

1. **Go to:** [Flippd Early Access](https://flippd.com) — or ask Britt for an access code
2. **Open on your phone** (iOS Safari or Android Chrome recommended)
3. **Take a photo** of an item at a thrift store
4. **Get a FLIP/PASS decision** with profit math in seconds
5. **Add to your inventory** and track your sales

### 📋 Requirements
- iPhone 12+ or Android phone (mobile-optimized)
- Camera access (for item scanning)
- Internet connection (API calls to Claude)

### 🎯 First Steps
1. **Scan one item** to see how it works
2. **Try shelf scan** — take a wide photo of a full shelf
3. **Add items you bought** to track profit
4. **Check STATS tab** to see your monthly earnings

---

## For Developers (Want to contribute?)

### 📦 Prerequisites
- Node.js 16+ (for backend)
- Git
- A text editor (VS Code recommended)
- iOS device or mobile browser for testing (important!)

### 🏗️ Local Development Setup

#### Clone the repo
```bash
git clone https://github.com/bbaker71313/flippd.git
cd flippd
```

#### Frontend (Flippd_v5.html)
No build step needed! Just:
1. Open `Flippd_v5.html` in any browser
2. Works offline immediately
3. Make changes, refresh browser to test

**Testing on your phone:**
- Same WiFi as your computer
- In browser, go to: `http://<your-computer-ip>:8000`
- (You'll need a simple HTTP server: `python -m http.server 8000`)

#### Backend (Node.js, optional for local dev)
If you want to test the proxy or subscription system:

```bash
cd backend
npm install
# Create .env with your API keys (see README.md)
ANTHROPIC_API_KEY=sk-ant-... node index.js
```

Backend runs on `http://localhost:3000`.

### 🧪 Testing Checklist Before You PR

- [ ] Test on a real mobile device (not just DevTools)
- [ ] Test portrait and landscape orientation
- [ ] Test with 0 items, 50 items, 500 items (edge cases)
- [ ] Verify profit math: $100 cost, $300 sell, 13% fee → $185.75 profit
- [ ] Check that settings changes apply immediately
- [ ] iOS: Test camera photo capture
- [ ] All 5 tabs are accessible and functional

### 📁 File Structure

```
flippd/
├── Flippd_v5.html              ← Frontend (all-in-one)
├── Flippd_Landing_Honest.html   ← Landing page
├── README.md                    ← Documentation
├── ROADMAP.md                   ← Feature priorities
├── DECISIONS.md                 ← Why we made certain choices
├── CLAUDE.md                    ← Development rules
│
├── backend/                     ← Node.js backend (optional)
│   ├── index.js                 ← Express app
│   ├── package.json
│   └── .env                     ← Secrets (not in Git)
│
└── docs/                        ← Documentation
    ├── ARCHITECTURE.md          ← How it all fits together
    ├── CONTRIBUTING.md          ← How to contribute
    └── GETTING_STARTED.md       ← This file
```

### 🎨 Code Style

**Frontend (HTML/JS):**
- Camel case: `ebayFeePercent`, not `eBay_fee_percent`
- Comments for major sections
- No `console.log()` in production (use `trackEvent()`)
- Template literals for HTML: `` `<div>${var}</div>` ``

**Backend (Node.js):**
- Async/await (no callbacks)
- Error handling for all API calls
- Type hints or JSDoc comments
- Test all auth flows

### 🚀 Making Your First Contribution

1. **Find an issue** in GitHub Issues, or identify a bug
2. **Create a branch:** `git checkout -b fix/your-issue-name`
3. **Make changes** to `Flippd_v5.html` or backend
4. **Test thoroughly** (use checklist above)
5. **Commit with clear message:** `git commit -m "[FRONTEND] Fix iOS camera double-fire"`
6. **Push and open PR:** `git push origin fix/your-issue-name`
7. **Wait for review** — Britt or another maintainer will review

**PR Tips:**
- Keep PRs focused (one fix or feature per PR)
- Test on real device before submitting
- Include before/after screenshots if UI change
- Reference issue number: `Fixes #42`

---

## For Team Members (Running Flippd?)

### 📊 Key Files to Understand

1. **`README.md`** — Project overview, how backend is deployed
2. **`ROADMAP.md`** — What features are coming and when
3. **`BUSINESS.md`** — Business model, GTM strategy, financials
4. **`DECISIONS.md`** — Why we made certain technical/product choices

### 🎯 Weekly Standup Topics

- Current scan volume and user retention
- Progress on ROADMAP features
- Issues blocking development
- Marketing metrics (signups, conversion, churn)

### 📈 Key Metrics to Track

- **DAU/WAU:** Daily/Weekly Active Users
- **Scans per user per week:** Engagement metric
- **Free-to-paid conversion rate:** Should be 15-20%
- **Monthly churn:** Should be <5% for paid users
- **MRR (Monthly Recurring Revenue):** Paying users × $19 (or tier price)

### 🔧 Deploying Backend Changes

**To Replit:**
1. Commit and push to GitHub
2. Replit auto-deploys (if linked)
3. Or manually: Replit → Import from GitHub

**To update frontend:**
1. Edit `Flippd_v5.html`
2. Commit to GitHub
3. No build step — changes live immediately when users refresh

### 🐛 Reporting Bugs to Claude

Include:
- Exact error message (screenshot if possible)
- Steps to reproduce
- Device/browser info
- What should happen instead
- Impact (blocker, minor annoyance, etc.)

---

## Troubleshooting

### "App won't load"
- Clear browser cache (Cmd+Shift+Del or equivalent)
- Try incognito/private mode
- Check browser console for errors (F12 → Console tab)

### "Camera not opening"
- On iOS: Check Settings → Safari → Camera access
- On Android: Check app permissions
- Try a different browser if Safari/Chrome doesn't work

### "Scan keeps failing"
- Check internet connection (should show speed test in console)
- Try a different item or photo quality
- If persistent, open GitHub Issue with photo you tried

### "Settings not saving"
- Check if browser allows localStorage (not in private mode)
- Try refreshing page
- Check browser console for errors

### "Loss of data after clearing browser"
- localStorage is cleared when you do "Clear Browsing Data"
- Always export CSV backup (INVENTORY tab → Export)
- Or use browser's "Don't clear" settings for this site

---

## Getting Help

- **GitHub Issues:** Bug reports and feature requests
- **Discussions:** Questions about usage
- **Email Britt:** For urgent issues or security concerns

---

## Next Steps

- **User?** → Try your first scan now
- **Developer?** → Set up local dev environment and find an issue to fix
- **Team member?** → Read ROADMAP.md and BUSINESS.md to understand context

---

## FAQ

**Q: Do I need an Anthropic API key to use Flippd?**  
A: No! The backend proxy handles that. Just sign up with your email.

**Q: Can I use Flippd offline?**  
A: Yes, you can view your inventory offline. But AI scans require internet.

**Q: How much does it cost?**  
A: Scout (free, 25 scans/mo), Hustle ($19/mo, unlimited), Stack ($49/mo), Empire ($199/mo).

**Q: Can I export my data?**  
A: Yes! INVENTORY tab → Export to CSV, or use JSON backup.

**Q: Is my data private?**  
A: Yes. We don't sell data. Inventory is stored in your browser and on our servers encrypted.

---

**Happy flipping!** 🎉

Questions? Open an issue or reach out to the team.
