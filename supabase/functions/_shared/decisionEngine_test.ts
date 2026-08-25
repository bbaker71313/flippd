// Runtime tests for the Deno decision engine. Run: `deno test supabase/functions/_shared/`
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decide, type DecisionInputs } from "./decisionEngine.ts";

const BASE: DecisionInputs = {
  netProfit: 100, roi: 250, sellThroughRate: 60, daysToSell: 20, demandLevel: "VERY HIGH",
  minProfit: 15, targetRoi: 200, minSellThroughRate: 30, maxDaysToSell: 60,
};

Deno.test("all thresholds passing + VERY HIGH demand -> HOT", () => {
  assertEquals(decide(BASE).decision, "HOT");
});

Deno.test("HIGH demand (not VERY HIGH) -> LIST", () => {
  assertEquals(decide({ ...BASE, demandLevel: "HIGH" }).decision, "LIST");
});

Deno.test("demand alone never triggers HOT without financial thresholds", () => {
  assertEquals(decide({ ...BASE, netProfit: 5 }).decision, "SKIP");
});

Deno.test("roi null (unknown/zero cost) never passes ROI threshold", () => {
  assertEquals(decide({ ...BASE, roi: null }).decision, "SKIP");
});

Deno.test("missing market evidence fails those thresholds, not fabricated as passing", () => {
  const r = decide({ ...BASE, sellThroughRate: null, daysToSell: null, demandLevel: null });
  assertEquals(r.decision, "SKIP");
});

Deno.test("boundary — profit exactly at minProfit passes, one cent below fails", () => {
  assertEquals(decide({ ...BASE, netProfit: 15, minProfit: 15 }).profitPass, true);
  assertEquals(decide({ ...BASE, netProfit: 14.99, minProfit: 15 }).profitPass, false);
});
