# FLIPPD — Testimonial Collection Process

**Goal:** Replace landing page placeholder quotes with real reseller quotes. Process is: Survey → Incentivize → Collect → Format → Deploy.

---

## PHASE 1: IDENTIFY ACTIVE USERS (Day 3-7)

**Target:** Users who have scanned 5+ times

Check early access data:
- Who has scanned most?
- Who added items to inventory?
- Who's been active consistently?

**Target: 10-15 active users to reach out to**

---

## PHASE 2: SURVEY EMAIL (Day 7-10)

**Send to:** Top 15 most active users

**Subject:** Quick question about your Flippd experience

**Email Template:**

```
Hi [First Name],

You've been using Flippd since [signup date]. I want to know what's actually working for you.

Quick question (reply in one line or a paragraph — either works):

What's the biggest difference Flippd has made for you so far?

Could be:
- A specific flip you found
- Time saved
- Better profit numbers
- Confidence in decisions
- Anything real

Just reply to this email. I read every response.

— Britt
```

**Expected response rate:** 30-40% (6-8 responses)

---

## PHASE 3: INCENTIVIZE (Optional)

**If response rate is low (<3 responses after 3 days):**

Send follow-up email:

```
Subject: Help me improve Flippd (+ free month bonus)

Hi [First Name],

I didn't hear back on my last email. Totally fine if you're busy.

But I really want to know: What's the biggest difference Flippd has made for you?

As a thank you for replying, I'll give you one month of Hustle tier free. No strings.

Just reply with your honest answer.

— Britt
```

**Incentive Options:**
- 1 month Hustle tier free ($19 value)
- 3 months Scout features free (if they're on free tier)
- Exclusive early access to next feature

---

## PHASE 4: COLLECT RESPONSES

**Create a spreadsheet:**

| User | Date | Original Response | Cleaned Quote | Category | Permission |
|------|------|---|---|---|---|
| User 1 | 4/28 | "I found a vintage camera..." | (see below) | The Find | Yes/No |

---

## PHASE 5: CLEAN & FORMAT QUOTES

**Raw response:**
```
"I've been using Flippd for 2 weeks now and I've found so many items I would have walked right past. The shelf scan especially has saved me hours and I've already made back the cost in good flips. It's a game changer for someone like me who sources at estate sales"
```

**Cleaned quote (60 words max):**
```
"The shelf scan saves me hours. I found so many items I would have walked past. I've already made back the cost in good flips. It's a game changer."
```

**Formatting Rules:**
- Remove filler ("I've been using for 2 weeks now" → irrelevant)
- Keep emotional language ("game changer," "saves me hours")
- Keep specific numbers if they exist ("made $500")
- Keep the person's voice
- 40-60 words max
- One quote per testimonial

---

## PHASE 6: CATEGORIZE BY TYPE

**Organize testimonials into buckets:**

### Type 1: The Speed Testimonial
*"How much faster Flippd is than manual research"*

Example:
```
"I used to spend 20 minutes writing one listing. Now I do it in under a minute."
— @thriftqueenATL
```

### Type 2: The Find Testimonial
*"Specific item they found they wouldn't have bought otherwise"*

Example:
```
"The shelf scan found a vintage speaker for $8 that sold for $110. I would have walked right past it without Flippd."
— @flippin_marcus
```

### Type 3: The Profit Testimonial
*"Accuracy of profit math / avoiding bad buys"*

Example:
```
"Flippd showed me I was underpricing electronics by 30%. Changed my whole strategy."
— @thatvintageguy
```

### Type 4: The Effort Testimonial
*"How much less manual work / guessing"*

Example:
```
"I don't waste time researching maybes anymore. Flippd tells me FLIP or PASS in 8 seconds."
— @reseller_name
```

**Use 3-4 testimonials on landing page:**
- 1 Type 1 (speed/effort)
- 1 Type 2 (discovery)
- 1 Type 3 (profit/accuracy)
- (Optional) 1 Type 4 (confidence)

---

## PHASE 7: GET PERMISSION

**Permission Email Template:**

```
Subject: Can I use your quote on our landing page?

Hi [First Name],

I loved what you said about Flippd. Would you be OK with me using this quote on our landing page?

"[CLEANED QUOTE]"

We'd credit you as:
[First name + @handle] if you want to share your Twitter/Instagram

If yes, just reply "yes" (that's all we need).

Thanks,
— Britt
```

**Expected permission rate:** 90%+ (most people are happy)

---

## PHASE 8: DEPLOY ON LANDING PAGE

**Update both Flippd_Landing_Honest.html and Flippd_Landing_FeatureRich.html:**

Replace placeholder testimonials:

**OLD (Placeholder):**
```html
<blockquote>
  "I used to spend 20 minutes writing one listing. Now I do it in under a minute."
  <footer>@thriftqueenATL, eBay, 200+ items/month</footer>
</blockquote>
```

**NEW (Real):**
```html
<blockquote>
  "[REAL QUOTE FROM EARLY ACCESS USER]"
  <footer>[First Name] [Last Name], [Platform], [Relevant Detail]</footer>
</blockquote>
```

**Deploy both updated landing pages to production**

---

## ONGOING COLLECTION (After Week 1)

**Recurring process:**

1. **Weekly:** Ask 2-3 of the most active users from past week (not just first week)
2. **Monthly:** Collect 3-5 fresh testimonials
3. **Rotate:** Replace quotes on landing page monthly to keep them fresh
4. **Video testimonials:** After collecting text quotes, ask if they'd do a 30-second video testimonial (optional)

**Video testimonial script:**
```
"Hi, I'm [Name]. I use Flippd to [primary use]. The best part is [specific benefit]. 
It's changed how I [outcome]. If you're a reseller, you should try it."

(30 seconds max)
```

---

## QUALITY CHECKLIST

Before deploying testimonial:

- [ ] Quote is <60 words
- [ ] Quote has one clear benefit message
- [ ] Quote uses reseller language (flip, profit, sourcing, etc.)
- [ ] Attribution includes name + platform/context
- [ ] Permission obtained from user
- [ ] Quote doesn't make claims we can't verify (no "changed my life," generic praise)
- [ ] Quote feels authentic (not corporate-sounding)

---

## OBJECTION HANDLING

**User hesitates on permission:**
```
"I want to make sure the quote is accurate before you use it. Can you send me the exact text?"
```

Send cleaned quote. They approve or request changes. Use approved version.

**User wants anonymity:**
```
"Can you use my quote but without my name?"
```

Use: "A reseller from early access" or "An eBay seller from our early access program"

**User wants to see it on landing page before approving:**
```
"Can I see the quote in context on the page before you publish?"
```

Send screenshot or draft. Get final approval.

---

## TIMELINE

| Date | Action |
|------|--------|
| Day 7 | Identify 15 most active users |
| Day 7-10 | Send survey emails |
| Day 10-14 | Collect responses |
| Day 14-18 | Clean + format + get permission |
| Day 18-21 | Update landing page |
| Day 21 | Deploy updated pages (with real testimonials) |

**Result by Day 21:** Landing page with real testimonials instead of placeholders

---

## TEMPLATE: CLEANED TESTIMONIAL

**Before:**
```
I've been using Flippd for about three weeks now and honestly it's changed the way I source completely. 
Instead of spending like 5-10 minutes checking eBay for each item I find at the thrift store, I just take 
a picture in Flippd and it tells me instantly if it's worth buying or not. The profit math is always 
accurate because of the configurable fee structure. I've probably saved like hours of time that I can now 
spend actually sourcing instead of researching. One time the shelf scan found like 7 items on one rack 
that I definitely would have walked right past without it. That shelf alone made me like $120 in profit. 
It's awesome.
```

**After:**
```
"I take a picture. Flippd tells me instantly if it's worth buying. The shelf scan found 7 items on one 
rack I would have missed — that one rack made me $120 profit."
— [Name], [Platform]
```

---

## TRACKING SPREADSHEET

Create a simple spreadsheet to track:

```
Testimonial Collection Status

Name | Email | Survey Sent | Response | Permission | Cleaned Quote | Deployed | Notes
-----|-------|---|---|---|---|---|---
User 1 | ... | ✓ | ✓ | ✓ | ✓ | ✓ | Great quote
User 2 | ... | ✓ | ✗ | — | — | — | No response after 7 days
...
```

---

## SUCCESS METRICS

- **Target:** 10+ testimonials collected by Day 28
- **Quality:** All testimonials specific + authentic (not generic)
- **Deployment:** 3-4 best testimonials live on landing page
- **Ongoing:** 2-3 new testimonials collected each month
