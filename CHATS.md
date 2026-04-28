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
**Current focus:** v5.2 complete — AI Power Listing Generator fully integrated
**Status:** Completed / Ready for next phase
**Scope:** Flippd_v5.html code, features, UX, data model, bug fixes
**Last touched:** April 27, 2026
**Summary:** Completed Phase 2.1 (AI Listing Generator). Built two-stage modal for listing generation, extracted 21 eBay leaf categories from user's actual listings, implemented persistent listing storage, built CSV export in exact eBay format, added inline preview in inventory cards. All tested and syntax-valid. Next: Manus proxy integration, then Phase 1.2 (access code system).

### [BACKEND] Proxy / Infrastructure
**Current focus:** Manus proxy URL integration
**Status:** Waiting on Manus delivery
**Scope:** Proxy backend, API routing, future FastAPI/database migration, eBay OAuth
**Last touched:** April 25, 2026

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
