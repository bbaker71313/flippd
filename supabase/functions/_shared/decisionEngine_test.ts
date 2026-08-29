// Runtime tests for the Deno decision engine. Run: `deno test supabase/functions/_shared/`
//
// Profit Scanner v2: sell-through rate / days-to-sell / demand level are no
// longer decision inputs. decide() only takes netProfit/roi/minProfit/
// targetRoi plus a decision-capable evidenceQuality ('strong'|'moderate').
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decide, type DecisionInputs } from "./decisionEngine.ts";

const BASE: DecisionInputs = {
  netProfit: 100, roi: 250, minProfit: 15, targetRoi: 200, evidenceQuality: "strong",
};

Deno.test("strong evidence + profit pass + roi pass -> HOT", () => {
  assertEquals(decide(BASE).decision, "HOT");
});

Deno.test("moderate evidence -> LIST, never HOT", () => {
  assertEquals(decide({ ...BASE, evidenceQuality: "moderate" }).decision, "LIST");
});

Deno.test("evidence quality alone never triggers HOT without financial thresholds", () => {
  assertEquals(decide({ ...BASE, netProfit: 5 }).decision, "SKIP");
});

// Zero-cost ROI correction (2026-08-26): null roi ($0 acquisition cost)
// bypasses the ROI threshold instead of failing it.
Deno.test("roi null ($0 acquisition cost) bypasses ROI threshold — not an automatic SKIP", () => {
  const r = decide({ ...BASE, roi: null });
  assertEquals(r.roiPass, true);
  assertEquals(r.decision, "HOT");
});

Deno.test("$0-cost item passing profit qualifies as HOT with strong evidence", () => {
  const r = decide({ ...BASE, roi: null });
  assertEquals(r.decision, "HOT");
});

Deno.test("$0-cost item still SKIPs when profit fails", () => {
  const r = decide({ ...BASE, roi: null, netProfit: 0 });
  assertEquals(r.decision, "SKIP");
});

Deno.test("normal nonzero-cost ROI threshold behavior is unchanged", () => {
  assertEquals(decide({ ...BASE, roi: 199.99, targetRoi: 200 }).decision, "SKIP");
});

Deno.test("boundary — profit exactly at minProfit passes, one cent below fails", () => {
  assertEquals(decide({ ...BASE, netProfit: 15, minProfit: 15 }).profitPass, true);
  assertEquals(decide({ ...BASE, netProfit: 14.99, minProfit: 15 }).profitPass, false);
});

Deno.test("moderate evidence caps at LIST even with large profit/roi margin", () => {
  const r = decide({ ...BASE, evidenceQuality: "moderate" });
  assertEquals(r.decision, "LIST");
  assertEquals(r.failingThresholds.length, 0);
});

Deno.test("moderate evidence does not turn a LIST into a SKIP, and does not affect a genuine SKIP", () => {
  assertEquals(decide({ ...BASE, evidenceQuality: "moderate" }).decision, "LIST");
  assertEquals(decide({ ...BASE, netProfit: 0, evidenceQuality: "moderate" }).decision, "SKIP");
});

Deno.test("result shape has no sell-through/days/demand fields", () => {
  const r = decide(BASE);
  assertEquals("strPass" in r, false);
  assertEquals("daysPass" in r, false);
  assertEquals("demandIsVeryHigh" in r, false);
  assertEquals("hotCappedByEvidence" in r, false);
});
