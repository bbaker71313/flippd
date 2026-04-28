# Contributing to Flippd

Thanks for your interest in contributing to Flippd! This guide explains how to report bugs, suggest features, and submit code.

---

## 🐛 Reporting Bugs

### Before You Report
- Check the [issue tracker](https://github.com/bbaker71313/flippd/issues) — your bug might already be reported
- Test on a fresh browser with cache cleared
- Note your device/browser (iPhone 12 Safari, Android Chrome, etc.)

### How to Report
1. Go to [Issues](https://github.com/bbaker71313/flippd/issues)
2. Click **New Issue**
3. Include:
   - What you were doing
   - What happened
   - What you expected to happen
   - Device/browser/OS
   - Screenshots if visual

**Example:**
```
Title: Shelf scan buy button unresponsive after 5+ items

Device: iPhone 13, Safari
OS: iOS 16

Steps to reproduce:
1. Open Flippd
2. Take a shelf photo with 8+ items
3. AI ranks items
4. Click "🛒 Buy" on item #6

Expected: Item added to inventory
Actual: Nothing happens, no error message
```

---

## 💡 Suggesting Features

### Before You Suggest
- Check [Roadmap](./ROADMAP.md) — feature might already be planned
- Check [Discussions](https://github.com/bbaker71313/flippd/discussions) — might already be discussed

### How to Suggest
1. Go to [Discussions](https://github.com/bbaker71313/flippd/discussions)
2. Click **New discussion**
3. Category: **Ideas**
4. Describe:
   - The use case (what problem are you solving?)
   - How it would work
   - Example workflow

**Example:**
```
Title: Auto-refresh inventory sell prices from eBay API

Use case: I sold 5 items this week but manually mark each one sold. 
It would be faster if Flippd checked eBay API and auto-updated.

How it could work:
1. In STATS tab, add "Sync with eBay" button
2. User authenticates with eBay once
3. Click sync → app fetches sold orders
4. Auto-mark matching items as "Sold"

This would save ~5 mins per week of manual marking.
```

---

## 💻 Contributing Code

### Development Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-username/flippd.git
cd flippd

# 2. No build step needed — just edit and test
# Open Flippd_v5.html in your browser (works offline)

# 3. Make changes to Flippd_v5.html

# 4. Test thoroughly:
# - Desktop browser (Chrome DevTools mobile simulation)
# - Real iOS device if possible
# - Try multiple scans (check memory)
# - Test offline mode (close DevTools network)

# 5. Commit your changes
git add Flippd_v5.html
git commit -m "Fix: shelf scan buy button unresponsive"

# 6. Push and open a PR
git push origin fix/shelf-buy-button
```

### Code Style

**JavaScript:**
- No external dependencies (vanilla JS only)
- Functions under 100 lines
- Google-style JSDoc comments

```javascript
/**
 * Calculate profit after eBay fees.
 *
 * @param {number} sellPrice - Sale price in cents
 * @param {number} costCents - Cost in cents
 * @param {number} feePercent - eBay fee percentage (default 13)
 * @returns {number} Profit in cents
 */
function calcProfit(sellPrice, costCents, feePercent = 13) {
  const fee = Math.round(sellPrice * (feePercent / 100));
  return sellPrice - costCents - fee;
}
```

**CSS:**
- Mobile-first (max-width 540px)
- Use CSS variables for theme colors
- Keep specificity low

```css
/* Good */
.action-btn {
  background: var(--green);
  padding: 8px 16px;
  border-radius: 8px;
}

/* Avoid */
.tab-panel .inventory-section .action-button {
  background: #00cc66;
}
```

**HTML:**
- Semantic HTML where possible
- No `<form>` tags (use onclick handlers)
- Keep attribute values short

### What to Work On

**Easy (good first issue):**
- Typos in docs or UI copy
- UI improvements (spacing, colors)
- Better error messages
- Performance optimizations

**Medium:**
- New feature development (see Roadmap)
- Cross-platform testing
- Mobile responsiveness fixes

**Hard:**
- eBay API integration
- Large refactors affecting multiple features
- Complex algorithmic changes

### Commit Messages

Be clear and specific:

```
✅ Good:
"Fix: shelf scan buy button unresponsive on item #6+"
"Feat: add image size limit (500KB) to prevent memory leak"
"Docs: update ROADMAP with Phase 3 timeline"
"Refactor: extract shelf item render logic to helper function"

❌ Avoid:
"Fixed bugs"
"Update code"
"WIP"
```

### Pull Request Process

1. **Create a branch** — name it descriptively
   ```bash
   git checkout -b fix/shelf-buy-button
   git checkout -b feat/add-poshmark-formatter
   git checkout -b docs/update-roadmap
   ```

2. **Make your changes** — commit frequently with clear messages

3. **Test thoroughly:**
   - Desktop browser (DevTools mobile view)
   - Real mobile device if possible
   - Multiple scans in a row (memory check)
   - Switch between tabs
   - Test offline

4. **Open a pull request:**
   - Title should clearly describe change
   - Link related issues: "Fixes #42"
   - Describe what you changed and why
   - Include before/after screenshots if visual

5. **Review process:**
   - I'll review within 48 hours
   - May ask for changes or clarifications
   - Once approved, merge to main

### Testing Checklist

Before submitting a PR:

- [ ] Feature works on mobile (iOS/Android)
- [ ] Feature works offline
- [ ] No console errors
- [ ] Memory usage stable (no leaks)
- [ ] All existing features still work
- [ ] Tested with different data (empty, large dataset)
- [ ] Code follows style guide
- [ ] Commit messages are clear

---

## 📋 Release Process

Version format: `vX.Y.Z` (Semantic Versioning)

- **Major (X):** Breaking changes, complete redesigns
- **Minor (Y):** New features, non-breaking additions
- **Patch (Z):** Bug fixes, performance improvements

Current version: **v5.2.1** (Production Ready)

---

## 🙏 Questions?

- Check existing [Issues](https://github.com/bbaker71313/flippd/issues)
- Start a [Discussion](https://github.com/bbaker71313/flippd/discussions)
- Email: [your-email@example.com]

Thanks for contributing!
