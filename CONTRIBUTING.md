# Contributing to Flippd

Thanks for your interest in contributing! Flippd is built by resellers, for resellers. We welcome bug reports, feature ideas, and pull requests.

---

## Getting Started

1. **Fork the repo** on GitHub
2. **Clone your fork** locally
3. **Create a branch** for your work: `git checkout -b feature/your-feature-name`
4. **Make your changes** (see style guide below)
5. **Test thoroughly** (especially on iOS/mobile)
6. **Push and open a PR** with a clear description

---

## Development Setup

### Frontend (Flippd_v5.html)

- Single HTML file, no build step
- Works offline, saved to localStorage
- Test on a real mobile device when possible
- Use Safari on iPhone or Chrome DevTools mobile mode

**Key rules:**
- Never hardcode API URLs — use `getApiUrl()` and `getApiHeaders()`
- Never hardcode eBay fees — always use `S.ebayFee`
- Keep file under 10,000 lines (refactor to separate module if needed)
- Test with 13% fee rate, $1.25 packaging cost, but verify logic works with any values

### Backend (Replit/Manus)

- FastAPI + SQLModel + Anthropic proxy
- Magic link auth via Resend
- Stripe webhooks for subscriptions
- Type hints required on all functions
- Run tests before PR: `pytest`

---

## Code Style

### JavaScript (HTML/JS)
- Use ES6+ (arrow functions, template literals, const/let)
- Camel case for variables: `ebayFeePercent`, `itemCost`
- Commented sections for major features
- No console.logs in production code (use `trackEvent()` for analytics)

### Python (Backend)
- Black formatter: `black .`
- Type hints on every function
- Google-style docstrings
- Tests mirror app structure

---

## What We're Looking For

### High Priority (please PR!)
- Bug fixes (especially iOS camera, landscape orientation, fee calculation)
- Performance improvements
- Accessibility fixes (contrast, keyboard nav)
- Documentation improvements

### Medium Priority
- UX improvements (if validated with users first)
- New features in ROADMAP.md
- Test coverage improvements

### Low Priority / Not Wanted
- Refactors without functional change
- UI customization (colors, fonts) — we have a specific design system
- New tabs or major structural changes (discuss first)

---

## Testing

### Frontend
- Test on iPhone 12+ (the minimum device)
- Test in landscape and portrait
- Test with 0 items, 100+ items (edge cases)
- Test with slow network (DevTools throttle)
- Verify profit math: cost $100, sell $300, fee 13%, pkg $1.25 → profit should be $185.75

### Backend
- Unit tests for all fee calculation logic
- Mock all external API calls (Anthropic, Stripe, Resend)
- Test auth flows (magic link, JWT, token refresh)
- Run `pytest -v` before PR

---

## Pull Request Process

1. **Title:** Use format: `[FRONTEND] [BACKEND] [DOCS] — Brief description`
   - Example: `[FRONTEND] Fix iOS camera double-fire on shelf scan`

2. **Description:** Include:
   - What problem this solves
   - How you tested it
   - Any breaking changes
   - Screenshots if UI change

3. **Review:** At least one approval before merge
   - Britt reviews strategy/GTM changes
   - Claude reviews code quality and fee logic

---

## Reporting Bugs

Use the bug template (see `.github/ISSUE_TEMPLATE/`). Include:
- Clear steps to reproduce
- Expected vs. actual behavior
- Screenshots/logs if possible
- Device and browser info

**Critical bugs** (profit math wrong, auth broken, data lost) get priority.

---

## Feature Ideas

Discuss in an issue first before building. We use ROADMAP.md as the source of truth for priorities.

**Bad PR:** Implement a feature that wasn't discussed
**Good PR:** Discuss in an issue → get feedback → implement → PR

---

## Questions?

- **Product questions:** Open an issue
- **Code questions:** Comment on the PR
- **Security issues:** Email directly (don't open public issue)

---

## Code of Conduct

- Be respectful and inclusive
- Assume good intent
- Give actionable feedback
- Celebrate wins

We're building a tool for resellers. That means hustle, directness, and respect for each other's time.

---

Thanks for building with us! 🎉
