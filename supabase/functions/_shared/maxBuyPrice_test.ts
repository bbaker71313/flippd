// Runtime tests for the Deno max-buy-price solver. Run: `deno test supabase/functions/_shared/`
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calcMaxBuyPrice } from "./maxBuyPrice.ts";

Deno.test("min-profit constraint limiting", () => {
  const r = calcMaxBuyPrice({ sellPrice: 100, ebayFee: 13, pkgCost: 1.25, shipCost: 0, minProfit: 50, targetRoi: 10 });
  assertEquals(r.maxCost, 35.75);
  assertEquals(r.limitedBy, "minProfit");
});

Deno.test("ROI constraint limiting", () => {
  const r = calcMaxBuyPrice({ sellPrice: 100, ebayFee: 13, pkgCost: 1.25, shipCost: 0, minProfit: 5, targetRoi: 200 });
  assertEquals(r.maxCost, 28.58);
  assertEquals(r.limitedBy, "targetRoi");
});

Deno.test("impossible profitable case returns null, not a misleading price", () => {
  const r = calcMaxBuyPrice({ sellPrice: 10, ebayFee: 13, pkgCost: 1.25, shipCost: 6, minProfit: 15, targetRoi: 200 });
  assertEquals(r.maxCost, null);
  assertEquals(r.limitedBy, "none");
});

Deno.test("seller-paid shipping lowers max cost vs buyer-paid", () => {
  const buyerPaid = calcMaxBuyPrice({ sellPrice: 100, ebayFee: 13, pkgCost: 1.25, shipCost: 0, minProfit: 15, targetRoi: 100 });
  const sellerPaid = calcMaxBuyPrice({ sellPrice: 100, ebayFee: 13, pkgCost: 1.25, shipCost: 8, minProfit: 15, targetRoi: 100 });
  assertEquals((sellerPaid.maxCost ?? 0) < (buyerPaid.maxCost ?? 0), true);
});
