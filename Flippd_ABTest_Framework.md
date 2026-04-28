# Flippd Landing Page — A/B Testing Framework

**Test Date:** April 28, 2026  
**Duration:** 2–4 weeks  
**Goal:** Determine which positioning and messaging approach converts higher-intent early access signups

---

## Hypothesis

**Because** resellers respond better to specificity and clear proof, **we believe** that a minimal, benefit-focused landing page (Honest variant) will convert higher than a feature-rich page with extended copy (Feature-rich variant). **We'll measure** email signup conversion rate, and know this is true when **conversion rate for Honest variant is 5%+ higher than Feature-rich variant** with 95% confidence.

---

## Variants

### Variant A: "Honest Minimal" — Flippd_Landing_Honest.html

**Positioning:** Scan the shelf. Know what to buy.

**Key differences:**
- Headline: Direct and simple ("Stop leaving money on the floor")
- Copy: Concise. One-sentence descriptions of differentiators.
- Social proof: Real quotes (with real signups), or blank slots for verification
- Length: ~2,000 words
- CTA density: High (multiple CTAs in hero, middle, and footer)
- Design: Clean, spacious, minimal visual noise
- Call-to-action: "Get Early Access"

**Audience:** Cold traffic (Reddit, Facebook groups, TikTok, newsletter swaps) — people who know what a reseller is and want the fastest value prop

---

### Variant B: "Feature Rich" — Flippd_Landing_FeatureRich.html

**Positioning:** The AI Reseller OS

**Key differences:**
- Headline: Broader ("Stop leaving money on the floor" + longer subheading)
- Copy: Detailed. Every feature gets a section with rationale.
- Social proof: Three real testimonials front-and-center
- Length: ~3,800 words
- CTA density: Medium (hero + email section + footer)
- Design: Gradient backgrounds, metric boxes, colored sections, visual hierarchy
- Call-to-action: "Send Me an Access Code"
- Pricing explanation: Full breakdown of all 4 tiers

**Audience:** Warm traffic (email list, referred users) — people who found Flippd through word-of-mouth or social and want comprehensive details before committing

---

## Test Setup

### Traffic Allocation
- 50/50 split (balanced A/B)
- Consistent per user (use browser cookie to ensure same variant on return)
- No pre-selection: randomize based on session start

### Primary Metric
**Email signup conversion rate** = (# emails submitted) / (# page views) = email_signups / page_views

- **Target for Honest variant:** 4.5%+
- **Target for Feature-rich variant:** 3.5%+
- **MDE (Minimum Detectable Effect):** 5% relative difference (e.g., Honest at 4%, Feature-rich at 3.8%)

### Secondary Metrics
- **Time on page** — does one variant engage longer?
- **Scroll depth** — which sections do users actually read?
- **CTA click rate by location** (hero vs. email section vs. footer) — where is attention?
- **Form field completion rate** — do email capture forms finish?
- **Return visitor rate** — do people come back after first view?

### Guardrail Metrics
- **Bounce rate** — if either variant has >60% bounce, stop test
- **Email field abandonment** — if users start form but don't submit >30%, test may be broken

### Sample Size Calculation

Given:
- Baseline email signup conversion: ~3% (assuming)
- Target improvement: +5% relative lift (MDE = 0.15% absolute)
- 95% confidence, 80% power
- **Required sample per variant: ~26,600 page views** (calculated at evanmiller.org/ab-testing/sample-size.html)

At 100 page views/day per variant = 133 days to reach sample size.
At 500 page views/day per variant = 27 days to reach sample size.

**Recommended test duration: 3–4 weeks at typical early access traffic levels**

---

## Implementation Details

### Technical Setup (JavaScript)

```javascript
// In page header or before page render:
function getVariant() {
  let variant = localStorage.getItem('flippd_landing_variant');
  
  if (!variant) {
    // Random 50/50 split
    variant = Math.random() < 0.5 ? 'honest' : 'featurerich';
    localStorage.setItem('flippd_landing_variant', variant);
  }
  
  return variant;
}

const variant = getVariant();

// Load correct file
if (variant === 'honest') {
  // Serve Flippd_Landing_Honest.html
} else {
  // Serve Flippd_Landing_FeatureRich.html
}

// Track variant assignment
gtag('set', { 'variant': variant });
```

### Analytics Events

**On page view:**
```javascript
gtag('event', 'page_view', {
  'page_title': 'Landing Page — ' + variant,
  'variant': variant,
  'page_location': window.location.href
});
```

**On email form submission:**
```javascript
function handleEmailSignup(e) {
  e.preventDefault();
  const name = e.target.querySelector('input[type="text"]').value;
  const email = e.target.querySelector('input[type="email"]').value;
  
  // Track signup
  gtag('event', 'email_signup', {
    'variant': variant,
    'email_entered': email
  });
  
  // Convert to backend
  // POST to /api/early-access or similar
  
  // Show success
  alert(`Thanks ${name}! Check your email for early access.`);
  e.target.reset();
}
```

**On scroll events (track engagement):**
```javascript
document.addEventListener('scroll', () => {
  const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
  
  if (scrollPercent > 25 && !window.flippd_scroll_25) {
    window.flippd_scroll_25 = true;
    gtag('event', 'scroll_25pct', { 'variant': variant });
  }
  // ... repeat for 50%, 75%, 100%
});
```

### GA4 Conversions

1. Create conversion in GA4 Admin → Conversions → New Conversion Event
   - Conversion name: `email_signup`
   - Include events: `email_signup`
2. Create comparison: Views vs. Signups by variant

---

## Decision Rules

### When to Call the Test

**If either variant reaches sample size first:**
- Run a chi-square test for statistical significance
- If p-value < 0.05 and confidence interval doesn't overlap: Winner exists
- If p-value > 0.05 or CI overlaps: Inconclusive, continue test

**Sample decision tree:**

```
Sample size reached?
├─ Yes: Check statistical significance
│  ├─ p < 0.05: Significant winner found → Implement winner
│  ├─ p > 0.05: No significant difference → Extend test 1 more week
│  └─ Secondary metrics tell story? → Qualitative decision
└─ No: Continue test (check guardrails weekly)
```

### Stopping Rules (Safety)

- If bounce rate exceeds 65% on either variant → investigate technical issues
- If email field abandonment exceeds 40% → test form UX in isolation
- If traffic drops >80% → likely external factor (outage, platform issue), pause test

---

## Expected Outcomes & Next Steps

### If Honest Variant Wins (>5% higher conversion)

**Implication:** Cold traffic (reseller communities, organic) prefers speed and clarity over comprehensiveness.

**Next steps:**
- Ship Honest as primary landing page
- Identify traffic sources that prefer Honest (Reddit, TikTok, email swaps)
- Create variant of Feature-rich for warm traffic (email list, existing users) — use as onboarding page
- Test: Even shorter variant (500 words only) with existing Honest structure

### If Feature-Rich Variant Wins (>5% higher conversion)

**Implication:** Visitors want reassurance through details, pricing, and comprehensive feature list.

**Next steps:**
- Ship Feature-rich as primary landing page
- Expand FAQ section based on support requests from signups
- Test: Add comparison table (Flippd vs. Underpriced.ai) to justify feature claims
- Test: Video demo showing shelf scan in action (3-5 min walkthrough)

### If No Significant Difference

**Implication:** Messaging isn't the bottleneck — traffic quality, CTA placement, or form friction is.

**Next steps:**
- Inspect secondary metrics: which sections hold attention longer?
- Test CTA placement/copy: "Get Early Access" vs. "Send Me a Code" vs. "Start Free"
- Test form fields: 2 fields (name + email) vs. 1 field (email only)
- Test email opt-in messaging: "No spam" disclaimer impact
- Run heatmap/session recording (Hotjar, FullStory) on winner to find friction

---

## Measurement Dashboard (GA4)

### Key Metrics to Track

| Metric | Honest Target | Feature-rich Target | Alert Threshold |
|--------|---|---|---|
| Email signups | 150+ | 100+ | <50 (stop test) |
| Conversion rate | 4.5% | 3.5% | <2% (investigate) |
| Bounce rate | <55% | <55% | >65% |
| Avg. session duration | 2m+ | 3m+ | <1m |
| Scroll to 75% | >40% | >50% | <20% |

---

## Qualitative Data Collection

While the test runs, collect qualitative feedback:

1. **Direct asks:** Email early access signups: "What convinced you to try Flippd?" — look for messaging patterns
2. **Support tickets:** Track questions from new users — unmet expectations indicate messaging issues
3. **Reddit/Twitter mentions:** Monitor reseller communities for organic commentary about landing page
4. **User interviews:** After 2 weeks, do 3-5 user interviews with signups from each variant — ask what worked

---

## Timeline

| Week | Action |
|------|--------|
| Week 1 | Launch both variants (50/50 split), verify tracking, monitor guardrails |
| Week 2 | Check interim metrics, collect qualitative feedback, monitor for issues |
| Week 3 | Continue test, analyze secondary metrics, prepare decision document |
| Week 4 | Reach statistical significance (likely), call test, document learnings |
| Week 5 | Implement winner, create playbook, set up next experiment |

---

## Playbook Entry (Post-Test)

Once test concludes, document learnings for future campaigns:

```
## Landing Page Messaging Test — [Winner]

**Date:** April 28 — May 26, 2026
**Result:** [Variant X] won with [X]% conversion vs. [Y]% (p=[value])
**Sample:** [N] page views per variant
**Lift:** [+X%] absolute, [+Y%] relative

**Why it worked:** [Analysis from secondary metrics + user feedback]
**Pattern:** [Reusable insight — e.g., "Resellers prefer concise copy with specific numbers over feature lists"]
**Apply to:** [Where else this pattern might work — email onboarding, product tour, pricing page]
**Confidence:** [High/Medium/Low based on effect size and feedback]
**Status:** IMPLEMENTED

**Follow-up tests to run:**
- [Idea 1]
- [Idea 2]
```

---

## Notes for Implementation

1. **Variant assignments must be consistent per user** — use cookies or local storage so returning visitors see the same variant
2. **Form should NOT auto-redirect** — let users see success message on-page so they know signup worked
3. **Email capture goes to one list** — tag by variant in your email provider (or backend) so you can segment later
4. **No changes mid-test** — both pages must stay static for duration (except bug fixes)
5. **Pre-announce test plan** — document expected sample size and duration so you don't stop early due to impatience

---

## Success Criteria (How to Know Test Succeeded)

✓ Both variants live for 3+ weeks without changes  
✓ Sample size reached (26k+ page views per variant)  
✓ Guardrail metrics never triggered  
✓ Statistically significant winner identified (p < 0.05)  
✓ Winner shipped to 100% of traffic  
✓ Learnings documented in playbook for future experiments  
✓ Follow-up test already queued  
