# Flippd — Chat Index

Master list of active work chats inside this Project.
Update when chats are started, paused, or completed.

---

## How this Project is organized

All Flippd work happens inside this single Project. Every chat sees the same files (CLAUDE.md, BUSINESS.md, ROADMAP.md, product-marketing-context.md, Flippd_v5.html, etc.) and shares memory.

Each chat is scoped to one work area. Start every new chat with a scope line (see SCOPE_TEMPLATES.md).

---

## Active Chats

### [APP] Product / App Build
**Current focus:** v5.4 — 10 frontend bug fixes
**Status:** Completed / Ready for next phase
**Scope:** Flippd_v5.html code, features, UX, data model, bug fixes
**Last touched:** May 1, 2026
**Summary:** v5.4 delivered 10 frontend bug fixes: tier banner, Save+List button, listing modal class fix, localStorage QuotaExceededError handling, null-safe tab switching, sub-screen scroll reset, Photo Enhancer memory leak, listing button visibility guard, photo limit reduced to 4, adaptive photo compression. Deployed to flippd.tech/Flippd_v5.html. Next: username/password auth flow polish, change-password endpoint.

### [BACKEND] Proxy / Infrastructure
**Current focus:** v3.0.0 live — Supabase PostgreSQL, bcrypt, username/password auth, email verification
**Status:** Live in production
**Scope:** Replit backend, Supabase DB, Stripe, Resend, Anthropic proxy, Telegram alerts
**Last touched:** May 1, 2026
**Summary:** Full backend live at https://flippd-backend.replit.app. Auth: register → verify email → login → JWT (90d). Stripe tiers active. Scan + inventory limits enforced. /auth/request-link alias added for landing page compatibility. BACKEND_LIVE.md and APP_INTEGRATION.md documented.

### [MARKETING] Landing / Copy / Content
**Current focus:** Honest landing page rewrite (no fake metrics/testimonials)
**Status:** Active
**Scope:** Flippd_Landing.html, copy, positioning, email capture, content marketing, social posts
**Last touched:** [date]

### [GROWTH] GTM / Launch / Channels
**Current focus:** Early access rollout plan
**Status:** Active
**Scope:** Launch strategy, Product Hunt, reseller community outreach, podcasts, paid ads, funnels
**Last touched:** [date]

### [STRATEGY] Business / Pricing / Roadmap
**Current focus:** Pricing tier validation
**Status:** Active
**Scope:** Pricing decisions, unit economics, roadmap prioritization, competitive moves, financial planning
**Last touched:** [date]

### [RESEARCH] Customer / Feedback / Validation
**Current focus:** Real testimonial collection
**Status:** Not started
**Scope:** Reseller interviews, feedback synthesis, testimonial collection, churn analysis, persona refinement
**Last touched:** —

---

## Paused / Completed

(Move chats here when work pauses or wraps. Keep them listed for reference.)

---

## Rules

1. One scope per chat. If a chat starts drifting, finish the current thread and open a new chat for the new topic.
2. Update this file when you start a new chat or change a chat's focus.
3. If a decision in one chat affects another area, log it in DECISIONS.md so it carries across.
4. Cross-cutting work (e.g. pricing strategy that affects the app's paywall) goes in the chat closest to where the *change* will be made — pricing decision lives in [STRATEGY], paywall implementation lives in [APP].
