# Flippd — Scope Line Templates

Paste the matching scope line as the FIRST message of every new chat in this Project.
This keeps Claude focused on one work area per chat.

---

## [APP] Product / App Build

> Scope: Flippd_v5.html only — features, code, UX, bug fixes, data model. Defer backend infrastructure, marketing copy, pricing decisions, and growth strategy to other chats. Read CLAUDE.md, DECISIONS.md, and ROADMAP.md before any code changes. Test with Node syntax check + Playwright before delivering.

---

## [BACKEND] Proxy / Infrastructure

> Scope: Backend only — Manus proxy integration, API routing, future FastAPI/database migration, eBay OAuth, webhooks. Defer app code, marketing, and pricing to other chats. The current canonical app is Flippd_v5.html — do not modify it here, only design the systems it will call. Read CLAUDE.md and ROADMAP.md before suggesting architecture.

---

## [MARKETING] Landing / Copy / Content

> Scope: Marketing only — Flippd_Landing.html, copy, positioning, email capture, content, social posts, ad creative. Defer app code, backend, and pricing decisions to other chats. All copy must follow product-marketing-context.md voice rules and use approved reseller language. No fabricated metrics or testimonials — only verified claims.

---

## [GROWTH] GTM / Launch / Channels

> Scope: Go-to-market only — launch strategy, Product Hunt, reseller community outreach (Reddit, Facebook groups, TikTok, YouTube), podcasts, paid ads, conversion funnel design. Defer product code and backend to other chats. Reference BUSINESS.md for the GTM phases and ROADMAP.md for what's launch-ready.

---

## [STRATEGY] Business / Pricing / Roadmap

> Scope: Strategy only — pricing decisions, unit economics, roadmap prioritization, competitive analysis, financial planning, "should we" decisions. Defer implementation work to [APP], [BACKEND], [MARKETING], or [GROWTH]. Log every settled decision in DECISIONS.md so it carries across chats.

---

## [RESEARCH] Customer / Feedback / Validation

> Scope: Customer research only — reseller interviews, feedback synthesis, testimonial collection, churn analysis, persona refinement, validation tests. Defer product changes and marketing copy to other chats. Output goes back into product-marketing-context.md (personas, language) and BUSINESS.md (validation findings).

---

## Cross-cutting note

If a chat spawns work in another area, don't do it in this chat. Note it in CHATS.md as a follow-up for the right chat, finish the current thread cleanly, then open the appropriate new chat.
