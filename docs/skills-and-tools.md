# Skills, MCPs & Tools — ScanForProfit Quick Reference

Daily reference for a solo developer/marketer building and marketing a SaaS app.
Items may appear in multiple categories when they serve multiple purposes.

---

## Quick-Reference Table

| Category | Skill Count |
|---|---|
| Coding & Development | 35 |
| AI & LLMs | 17 |
| Marketing & Growth | 38 |
| Design & UI | 17 |
| Data & Analytics | 10 |
| DevOps & Infrastructure | 20 |
| Research & Web | 8 |
| Productivity & Automation | 16 |
| Finance & Payments | 6 |
| Video & Media | 14 |
| Comms & Social | 9 |

---

## Coding & Development

### `/code-review`
Multi-pass review covering correctness, security, performance, and edge cases. Use before any merge or deploy.

### `/security-review`
Security-focused code review: OWASP Top 10, secrets leakage, injection, auth flaws. Use before shipping anything user-facing.

### `/security-audit`
Full security audit of a codebase or feature — broader than a single review pass. Use for compliance checkpoints.

### `/security-scan`
Automated scan for known vulnerabilities, exposed secrets, and CVEs in dependencies.

### `/tdd-workflow`
Guides red-green-refactor TDD cycles. Use when building new features with tests first.

### `/test-and-fix`
Runs tests, interprets failures, and applies fixes. Use when tests are broken and you need them green fast.

### `/test-gaps`
Identifies untested code paths and missing edge cases. Use to improve coverage on existing code.

### `/e2e-testing`
Sets up and runs end-to-end tests across full user flows. Use for critical paths like auth, checkout, and scan results.

### `/webapp-testing`
Web app testing patterns — unit, integration, and functional tests. Use for Next.js and web feature testing.

### `/playwright-cli`
Drives Playwright from the CLI for scripted browser automation and testing.

### `/browser-test`
Browser-based UI testing using real or headless browsers. Use for visual regression and interaction testing.

### `/pair-programming`
Interactive pair-programming mode — thinks alongside you, flags issues, and suggests alternatives in real time.

### `/diff-analyze`
Analyzes a git diff or PR for intent, risk, and code quality issues. Use to review what actually changed.

### `/dependency-check`
Audits package dependencies for outdated versions, known CVEs, and license issues.

### `/database-migrations`
Generates, validates, and applies database migrations safely. Use with Supabase/Postgres schema changes.

### `/api-design`
REST API design guidance — conventions, response formats, pagination, auth, rate limiting. Use when designing endpoints.

### `/api-docs`
Generates API documentation from source code with JSDoc and OpenAPI support.

### `/doc-gen`
Generates inline and external documentation from code. Use when you need JSDoc, TSDoc, or README content.

### `/docker-patterns`
Docker best practices — Dockerfiles, compose configs, layer caching, multi-stage builds.

### `/golang-patterns`
Go language patterns, idioms, and best practices. Use for Go services or Edge Functions.

### `/python-patterns`
Python patterns, idioms, and best practices. Use for Python scripts, data pipelines, or backend services.

### `/rust-patterns`
Rust patterns and idioms. Use for performance-critical code or WASM targets.

### `/django-patterns`
Django framework patterns — models, views, serializers, and auth. Use for Django backend work.

### `/laravel-patterns`
Laravel framework patterns — Eloquent, Blade, queues, and routing. Use for PHP backend work.

### `/springboot-patterns`
Spring Boot patterns for Java/Kotlin backends — controllers, services, JPA, and security.

### `/react-components`
React component patterns — hooks, composition, state, and performance. Use for web frontend work.

### `/shadcn-ui`
shadcn/ui component usage, customization, and integration with Tailwind. Use for Next.js web UI work.

### `/simplify`
Reviews changed code for reuse, simplification, and efficiency improvements. Quality-focused — not bug hunting.

### `/bughunter`
Hunts for bugs across a codebase or feature — logic errors, off-by-ones, null paths, and race conditions.

### `/systematic-debugging` (via `superpowers:systematic-debugging`)
Structured debugging methodology — isolate, reproduce, hypothesize, verify. Use when stuck on a hard bug.

### `/init`
Initializes a new project with the correct structure, configs, and tooling for this stack.

### `/run`
Launches the app and observes real behavior to confirm a change works. Use to verify fixes in the actual running app.

### `/verify` (via `superpowers:verification-before-completion`)
Verifies a code change actually does what it claims — runs the app and checks behavior before marking done.

### **MCP: Context7** (`mcp__claude_ai_Context7__query-docs`, `mcp__claude_ai_Context7__resolve-library-id`)
Fetches current documentation for any library, framework, SDK, or CLI tool. Use instead of relying on training data for Expo, Supabase, NativeWind, Stripe, etc.

### **MCP: Sentry** (`mcp__claude_ai_Sentry__*`)
Query errors, analyze issues with AI (Seer), update issue status, search events. Use to investigate production errors directly from Claude.

---

## AI & LLMs

### `/claude-api`
Reference for the Claude/Anthropic API — model IDs, pricing, parameters, streaming, tool use, MCP, caching, and token counting. Always use this before answering LLM questions — never rely on training data.

### `/llm-config`
Configures LLM provider settings, model selection, and parameters for your project.

### `/llmwhisperer`
Expert prompting guidance — how to get better outputs from LLMs for specific task types.

### `/embeddings`
Generates and works with text embeddings for semantic search, clustering, and similarity.

### `/vector-search`
Implements semantic vector search for intelligent document retrieval and context-aware querying.

### `/vector-embed`
Creates vector embeddings and manages embedding pipelines.

### `/agentdb-memory-patterns`
Persistent memory patterns for AI agents — session memory, long-term storage, and context management.

### `/agentdb-vector-search`
Semantic vector search with AgentDB for RAG systems and intelligent knowledge bases.

### `/agentdb-learning-plugins`
Creates and trains AI learning plugins using reinforcement learning algorithms.

### `/agentdb-performance-optimization`
Optimizes AgentDB with quantization, HNSW indexing, and batch operations for scale.

### `/prompt-optimizer`
Analyzes and improves prompts for better LLM output quality and consistency.

### `/enhance-prompt`
Rewrites or expands a prompt to be more effective for a specific task.

### `/deep-research`
Multi-step research agent — searches, synthesizes, and summarizes information on complex topics.

### `/research-synthesize`
Synthesizes research from multiple sources into structured, actionable summaries.

### `/cost-optimize`
Analyzes LLM usage and recommends cost-reduction strategies — model switching, caching, batching.

### `/cost-track`
Tracks LLM API spend across sessions and models.

### `/cost-report`
Generates a cost report for LLM usage over a time period.

### **MCP: Context7** (`mcp__claude_ai_Context7__*`)
Pull live docs for any AI SDK or framework — Anthropic SDK, LangChain, Vercel AI SDK, etc.

---

## Marketing & Growth

### `/seo`
General SEO guidance — keyword strategy, on-page optimization, and technical health.

### `/seo-audit`
Full technical and on-page SEO audit of a website. Returns a prioritized issue list.

### `/seo-content`
Creates SEO-optimized content — blog posts, landing pages, and product descriptions.

### `/seo-technical`
Fixes technical SEO issues — crawlability, indexing, Core Web Vitals, structured data.

### `/seo-local`
Local SEO optimization — Google Business Profile, local citations, and geo-targeted content.

### `/seo-competitor-pages`
Analyzes competitor pages for keyword gaps, content structure, and positioning opportunities.

### `/seo-plan`
Builds a full SEO strategy plan — keyword targets, content roadmap, and link-building priorities.

### `/seo-flow`
Maps the user journey from search query to conversion for SEO-driven pages.

### `/seo-cluster`
Builds topic clusters — pillar pages and supporting content for topical authority.

### `/seo-page`
Optimizes a single page for a target keyword — title, meta, headings, copy, and links.

### `/seo-schema`
Adds structured data (JSON-LD schema markup) to pages for rich search results.

### `/seo-sitemap`
Generates or audits XML sitemaps for correct structure, coverage, and submission.

### `/seo-backlinks`
Backlink strategy — finding opportunities, outreach, and disavow guidance.

### `/seo-images`
Image SEO — alt text, file naming, compression, and lazy loading for search visibility.

### `/seo-ecommerce`
E-commerce-specific SEO — product pages, category pages, faceted navigation, and schema.

### `/seo-geo`
Geo-targeted SEO for international or multi-location businesses — hreflang and regional targeting.

### `/seo-programmatic`
Programmatic SEO — templates, data-driven page generation, and scaled content production.

### `/seo-google`
Google-specific SEO — Search Console, algorithm updates, and Google quality guidelines.

### `/ai-seo`
Optimizes content for AI search engines (AEO/GEO) — getting cited by ChatGPT, Perplexity, Claude. Includes llms.txt setup.

### `/copywriting`
Writes compelling marketing copy — landing pages, product descriptions, headlines, and CTAs.

### `/ad-creative`
Generates and iterates ad creative at scale — headlines, descriptions, and full ad variations for any platform.

### `/ads`
Paid advertising campaign strategy — Google Ads, Meta, LinkedIn, Twitter/X. Covers targeting, bidding, and ROAS optimization.

### `/ab-testing`
Plans and designs A/B tests — hypothesis writing, variant design, statistical significance, and experiment velocity.

### `/content-strategy`
Content strategy planning — editorial calendar, audience targeting, and channel mix.

### `/email`
Email marketing — campaigns, sequences, subject lines, and deliverability.

### `/cold-email`
Cold outreach email sequences — personalization, deliverability, and follow-up cadences.

### `/brand-guidelines`
Creates or enforces brand guidelines — voice, tone, visual identity, and usage rules.

### `/marketing-plan`
Builds a full go-to-market or ongoing marketing plan — channels, budget, and milestones.

### `/marketing-ideas`
Brainstorms marketing campaigns, growth tactics, and promotional ideas.

### `/competitor-profiling`
Profiles competitors — positioning, pricing, messaging, strengths, and weaknesses.

### `/cro`
Conversion rate optimization — landing page improvements, funnel analysis, and A/B hypotheses.

### `/analytics`
Analytics setup and analysis — event tracking, funnels, retention, and metric interpretation.

### `/social`
Social media content and strategy — platform-specific copy, posting cadence, and engagement tactics.

### `/aso`
App Store Optimization — keywords, title, description, screenshots, and ratings strategy for the App Store and Google Play.

### `/programmatic-seo`
Programmatic SEO — building scaled, data-driven page systems for long-tail keyword coverage.

### **MCP: Blotato** (`mcp__claude_ai_BLOTATO__*`)
Social media scheduling and publishing across platforms — create posts, schedule content, manage publishing queues, and track post status.

### **MCP: Windsor.ai** (`mcp__claude_ai_Windsor_ai__*`)
Pull marketing data from 325+ connectors (Meta Ads, Google Ads, GA4, Shopify, Klaviyo, and more) and write changes back — pause campaigns, adjust budgets — without leaving Claude.

---

## Design & UI

### `/impeccable`
Full UI/UX design intelligence — audit, polish, and redesign interfaces. Covers visual hierarchy, typography, color, spacing, accessibility, and micro-interactions. Use for any frontend design work.

### `/frontend-design`
Guidance for distinctive, intentional visual design — aesthetic direction, typography, and avoiding templated-looking defaults.

### `/ui-ux-pro-max`
Comprehensive UI/UX design with 50+ styles, 161 color palettes, 57 font pairings, and 25 chart types across React, Next.js, React Native, and more.

### `/high-end-visual-design`
Creates high-end, polished visual design — premium aesthetics, sophisticated typography, and refined layouts.

### `/design-taste-frontend`
Applies strong design taste to frontend code — transforms generic-looking UIs into distinctive ones.

### `/canvas-design`
Canvas-based design work — generative graphics, data visualization, and custom visual compositions.

### `/image`
Generates images from text descriptions. Use for UI mockups, marketing visuals, and concept art.

### `/image-ad-clone`
Clones the visual style of an existing ad image and generates variations. Use for ad creative iteration.

### `/brandkit`
Creates a cohesive brand kit — logo directions, color palettes, typography, and usage examples.

### `/imagegen-frontend-web`
Generates frontend-ready images optimized for web contexts — dimensions, formats, and compression.

### `/imagegen-frontend-mobile`
Generates frontend-ready images optimized for mobile contexts — retina-ready and properly sized.

### `/minimalist-ui`
Designs clean, minimal interfaces — maximum whitespace, restrained color, and focused content hierarchy.

### `/industrial-brutalist-ui`
Designs bold, brutalist UI — high-contrast, raw typography, and intentional visual tension.

### `/algorithmic-art`
Creates algorithmic/generative art using p5.js — flow fields, particle systems, and seeded randomness.

### `/stitch-design-taste`
Applies strong design taste to Stitch/component-based design systems.

### `/stitch-generate-design`
Generates designs within a Stitch design system framework.

### `/stitch-react-native`
Creates React Native components with Stitch design system patterns.

### **MCP: Figma** (`mcp__claude_ai_Figma__*`)
Read designs from Figma into code, push code into Figma, manage design tokens, search design systems, generate diagrams, and create new files. The primary bridge between code and design.

### **MCP: Cloudinary** (`mcp__claude_ai_Cloudinary__*`)
Image and video asset management — upload, transform, organize, search, and generate archives. Use for all media asset operations (scan photos, product images, listing images).

---

## Data & Analytics

### `/analytics`
Analytics setup, event tracking design, funnel analysis, and metric interpretation.

### `posthog:instrument-product-analytics`
Instruments PostHog product analytics — event capture, user identification, and property tracking.

### `posthog:querying-posthog-data`
Queries PostHog data — insights, funnels, retention, and HogQL for custom analysis.

### `posthog:creating-experiments`
Sets up PostHog A/B experiments — feature flags, holdout groups, and metric definitions.

### `posthog:investigating-error-issue`
Investigates PostHog error tracking issues — session replays, stack traces, and user context.

### `/sentry:sentry-workflow`
End-to-end Sentry workflow — triage, investigate, fix, and resolve errors systematically.

### `/sentry:seer`
Uses Sentry's AI (Seer) to analyze issues, identify root causes, and suggest fixes.

### `astronomer-data:authoring-dags`
Authors Airflow DAGs for data pipeline orchestration. Use for scheduled data jobs.

### `/database-migrations`
Generates and applies database migrations safely — covers Supabase/Postgres schema changes.

### `/postgres-patterns`
PostgreSQL patterns — query optimization, indexing, RLS, and schema design best practices.

### **MCP: Sentry** (`mcp__claude_ai_Sentry__*`)
Direct access to Sentry — search issues, analyze with AI, update status, search events. Use to work with production errors without leaving Claude.

### **MCP: Windsor.ai** (`mcp__claude_ai_Windsor_ai__*`)
Pull analytical data from 325+ connectors — GA4, Google Ads, Meta Ads, Shopify, Stripe, BigQuery, and more. Read metrics and write changes back to ad platforms.

### `cloud-sql-postgresql:cloud-sql-postgres-admin`
Administers Cloud SQL PostgreSQL instances — users, permissions, backups, and configuration.

---

## DevOps & Infrastructure

### `vercel:deploy`
Deploys the current project to Vercel — pass "prod" for production, default is preview.

### `vercel:status`
Checks Vercel deployment status and recent deployment history.

### `vercel:env`
Manages Vercel environment variables across preview, development, and production.

### `vercel:deployments-cicd`
Sets up Vercel CI/CD pipelines — GitHub Actions integration, preview deploys, and promotion workflows.

### `vercel:nextjs`
Next.js on Vercel best practices — rendering strategies, caching, and Vercel-specific config.

### `vercel:vercel-functions`
Vercel serverless and edge function patterns — runtime config, streaming, and performance.

### `vercel:runtime-cache`
Vercel runtime caching strategies — ISR, fetch cache, and on-demand revalidation.

### `vercel:vercel-storage`
Vercel storage products — KV, Blob, Postgres, and Edge Config setup and usage.

### `netlify-skills:netlify-deploy`
Deploys to Netlify — build config, publish directories, and deploy hooks.

### `netlify-skills:netlify-functions`
Netlify serverless functions — authoring, environment variables, and invocation patterns.

### `netlify-skills:netlify-edge-functions`
Netlify Edge Functions — middleware, geolocation, and request/response manipulation.

### `expo:expo-deployment`
Deploys Expo apps — EAS Build, OTA updates, and app store submission workflows.

### `expo:eas-update-insights`
Analyzes EAS Update performance — adoption rates, rollout health, and update troubleshooting.

### `expo:expo-cicd-workflows`
Sets up CI/CD for Expo — GitHub Actions, EAS Build triggers, and automated testing.

### `/docker-hub`
Manages Docker Hub images — pushing, pulling, tagging, and repository configuration.

### `/git-workflow`
Git branching strategy, commit conventions, and workflow patterns for team or solo development.

### `/github-automation`
Automates GitHub workflows — issue management, PR templates, and repository configuration.

### `/github-workflow-automation`
Creates and manages GitHub Actions workflows for CI, CD, and automated tasks.

### `/deploy-web-easypanel`
Deploys web applications to Easypanel — container config, domains, and service management.

### `/linux-server-audit`
Audits a Linux server for security, performance, and configuration issues.

### **MCP: Cloudflare** (`mcp__claude_ai_Cloudflare_Developer_Platform__*`)
Manages Cloudflare Workers, KV namespaces, R2 buckets, D1 databases, and Hyperdrive configs. Use for edge functions, global storage, and CDN configuration.

### **MCP: Vercel** (`mcp__claude_ai_Vercel__*`)
Full Vercel control — list projects, view deployments, read build logs, get runtime logs, check domains, and import designs. Use for deployment management and debugging.

---

## Research & Web

### `/deep-research`
Multi-step research agent — searches the web, reads sources, synthesizes, and summarizes. Use for competitor research, market analysis, and technical investigation.

### `/research-synthesize`
Synthesizes information from multiple sources into structured, actionable summaries.

### `/competitor-profiling`
Profiles competitors — positioning, pricing, messaging, strengths, weaknesses, and market gaps.

### `/browser`
General browser automation — navigate, click, fill forms, and extract content.

### `/browser-scrape`
Scrapes web pages for structured data — tables, lists, prices, and product data.

### `/browser-extract`
Extracts specific content from web pages — articles, data points, and structured information.

### `firecrawl:firecrawl-search` (via `firecrawl:firecrawl-cli`)
Real-time web search with full page content. Use when you need current information from the web.

### **MCP: Nimble** (`mcp__claude_ai_Nimble__*`)
Web scraping and data extraction agents — crawl sites, extract structured data, run search queries, and manage extraction tasks. Use for competitor monitoring, price tracking, and data collection.

---

## Productivity & Automation

### `/n8n-workflow`
Designs and builds n8n automation workflows. Use for the ScanForProfit n8n Cloud instance.

### `/n8n-workflow-patterns`
n8n workflow patterns and best practices — triggers, error handling, and data transformation.

### `/n8n-mcp-tools-expert`
Expert guidance on using n8n's MCP tools and AI agent nodes within workflows.

### `/workflow-automation`
General workflow automation — maps manual processes to automated pipelines.

### `/workflow-create`
Creates new automation workflows from scratch across any platform.

### `/cron-schedule`
Sets up and manages cron-based scheduled tasks.

### `/schedule`
Creates, updates, and lists scheduled cloud agents that run on a cron schedule. Use for recurring Claude Code tasks.

### `/loop`
Runs a prompt or slash command on a recurring interval. Use for polling, monitoring, or repeated tasks.

### `/hooks-automation`
Sets up Claude Code hooks — pre/post tool automation for consistent behaviors.

### `/browser`
Browser automation — navigate, interact, and extract data from any web page.

### `/browser-form-fill`
Automates form filling across web pages. Use for data entry, submissions, and account setup.

### `/browser-record`
Records browser interactions for replay and automation scripting.

### `/browser-screenshot-diff`
Compares screenshots before and after a change to detect visual regressions.

### `/memory-management`
Manages persistent memory across Claude Code sessions — stores and retrieves context.

### `/session-management`
Manages Claude Code session state, context, and persistence between conversations.

### `/update-config`
Configures the Claude Code harness — settings.json, hooks, permissions, and env vars. Use when you want Claude to do something automatically ("whenever X, do Y").

### `/fewer-permission-prompts`
Scans transcripts and adds read-only tool allowlists to reduce permission friction during sessions.

### **MCP: Notion** (`mcp__claude_ai_Notion__*`)
Read, write, and query Notion databases and pages — create tasks, search content, update pages, and manage databases. Use for project management and documentation.

### **MCP: Google Drive** (`mcp__claude_ai_Google_Drive__*`)
Search, read, create, and manage Google Drive files. Use for accessing shared documents, spreadsheets, and assets.

---

## Finance & Payments

### `stripe:stripe-projects`
Manages Stripe project configuration — products, prices, and webhook setup for ScanForProfit tiers.

### `stripe:stripe-best-practices`
Stripe integration best practices — idempotency, webhook verification, and error handling.

### `stripe:explain-error`
Explains Stripe error codes and decline reasons with context and remediation steps.

### `stripe:test-cards`
Provides Stripe test card numbers for specific scenarios — declines, 3DS, insufficient funds.

### `/agent-payments`
Agentic payments patterns — autonomous payment flows, billing logic, and subscription management.

### **MCP: Stripe** (`mcp__claude_ai_Stripe__*`)
Direct Stripe API access — search resources, read payment data, create refunds, query subscriptions, and manage accounts. Use to investigate billing issues or manage payments without leaving Claude.

---

## Video & Media

### `/video`
General video creation and editing guidance — scripting, structure, and platform-specific formats.

### `/remotion`
Creates programmatic videos in React using Remotion. Use for animated product demos, data visualizations, and marketing videos.

### `hyperframes:hyperframes`
HeyGen HyperFrames — programmable HTML-based video projects with cloud rendering.

### `hyperframes:hyperframes-cli`
HyperFrames CLI — initialize, lint, preview, and render video compositions locally.

### `hyperframes:general-video`
General video composition with HyperFrames — scenes, animations, and text overlays.

### `hyperframes:faceless-explainer`
Creates faceless explainer videos — narration, slides, and B-roll without on-camera talent.

### `runway-api:rw-generate-video`
Generates AI video from text prompts or images using the Runway API.

### `runway-api:rw-generate-image`
Generates AI images using Runway. Use for marketing visuals, concept art, and ad creative.

### `runway-api:rw-generate-audio`
Generates AI audio — voiceovers, sound effects, and background music via Runway.

### `/whisper-transcribe`
Transcribes audio and video files to text using Whisper. Use for creating captions, notes from recordings, and searchable transcripts.

### `/pdf`
Creates, reads, and processes PDF files — extraction, generation, and conversion.

### `/pptx`
Creates and edits PowerPoint presentations. Use for pitch decks, investor materials, and reports.

### `/docx`
Creates and edits Word documents. Use for contracts, reports, and formal documentation.

### `/xlsx`
Creates and edits Excel spreadsheets. Use for financial models, data tables, and reporting.

### **MCP: Cloudinary** (`mcp__claude_ai_Cloudinary__*`)
Full media asset management — upload, transform, search, rename, and organize images and videos. Use to manage all ScanForProfit media assets.

### **MCP: Descript** (`mcp__claude_ai_Descript__*`)
AI-powered video and audio editing — import media, run AI edits via natural language (trim, remove filler words, add captions), and export or publish. Use for creating product demos and marketing videos.

### **MCP: HyperFrames/HeyGen** (`mcp__claude_ai_HyperFrames_by_HeyGen__*`)
Create and render HeyGen video projects in the cloud — compose, render, and retrieve hosted video outputs. Use when you need a cloud-rendered, shareable video output.

### **MCP: Splice** (`mcp__claude_ai_Splice__*`)
Music and audio samples — search sounds, describe audio, create stacks, and download assets. Use for background music and sound effects in marketing videos.

---

## Comms & Social

### **MCP: Slack** (`mcp__claude_ai_Slack__*`)
Full Slack access — send messages, read channels and threads, search, create canvases, list members, schedule messages, and add reactions. Use for team communication and notifications.

### **MCP: Gmail** (`mcp__claude_ai_Gmail__*`)
Read, compose, and organize Gmail — search threads, create drafts, apply labels, and manage conversations. Use for customer support, outreach, and inbox management.

### **MCP: Google Calendar** (`mcp__claude_ai_Google_Calendar__*`)
Manage calendar events — create, update, delete, list, and respond to events. Use for scheduling launches, content publishing, and meetings.

### **MCP: Notion** (`mcp__claude_ai_Notion__*`)
Docs, databases, and task management — create pages, query databases, update content, and search. Use as the team knowledge base and project tracker.

### **MCP: Blotato** (`mcp__claude_ai_BLOTATO__*`)
Social media scheduling — create and schedule posts, manage publishing queues, and track post status across platforms.

### `/social`
Social media content and strategy — platform-specific copy, hashtags, and posting cadence.

### `/email`
Email marketing campaigns — sequences, subject lines, copywriting, and deliverability guidance.

### `/cold-email`
Cold outreach sequences — personalization frameworks, deliverability, and follow-up cadences.

### **MCP: Gamma** (`mcp__claude_ai_Gamma__*`)
Create AI-powered presentations, documents, and web pages. Use for pitch decks, investor presentations, and polished content documents.

---

## Tips for This Project

**ScanForProfit-specific tool routing:**

| Task | Use This |
|---|---|
| Supabase schema change | `/database-migrations` + `postgres-patterns` |
| EAS build issue | `expo:expo-deployment` + `expo:eas-update-insights` |
| Stripe tier/billing | `stripe:stripe-projects` + **MCP: Stripe** |
| Marketing copy | `/copywriting` + `/ad-creative` |
| App Store listing | `/aso` + `/copywriting` |
| eBay SEO research | `/seo-ecommerce` + `/seo-competitor-pages` |
| AI prompt tuning | `/prompt-optimizer` + `/enhance-prompt` |
| Production error | **MCP: Sentry** + `/sentry:seer` |
| Analytics event | `posthog:instrument-product-analytics` |
| Social post | **MCP: Blotato** + `/social` |
| Library docs | **MCP: Context7** |
| Competitor research | `/competitor-profiling` + **MCP: Nimble** |
| n8n automation | `/n8n-workflow` + `/n8n-mcp-tools-expert` |
| Marketing data | **MCP: Windsor.ai** |
| Deploy web | `vercel:deploy` + **MCP: Vercel** |
| Deploy mobile | `expo:expo-deployment` |
| Design work | **MCP: Figma** + `/impeccable` |
| Asset management | **MCP: Cloudinary** |
