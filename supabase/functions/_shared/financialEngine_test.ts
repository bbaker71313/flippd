// Runtime tests for the Deno financial engine. Run: `deno test supabase/functions/_shared/`
import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calcProfit } from "./financialEngine.ts";

Deno.test("happy path — standard flip with default fee 13%", () => {
  const r = calcProfit({ sellPrice: 100, cost: 20, pkgCost: 1.25, shipCost: 6, ebayFee: 13 });
  assertEquals(r.net, 59.75);
  assertEquals(r.roi, 298.75);
});

Deno.test("zero cost -> roi is null, never a fabricated 0%", () => {
  const r = calcProfit({ sellPrice: 50, cost: 0, pkgCost: 1.25, shipCost: 6, ebayFee: 13 });
  assertEquals(r.roi, null);
});

Deno.test("negative profit when sell below cost+fees", () => {
  const r = calcProfit({ sellPrice: 10, cost: 20, pkgCost: 1.25, shipCost: 6, ebayFee: 13 });
  assertEquals(r.net < 0, true);
});

Deno.test("invalid input — negative cost throws", () => {
  assertThrows(() => calcProfit({ sellPrice: 50, cost: -1, pkgCost: 0, shipCost: 0, ebayFee: 13 }));
});

Deno.test("invalid input — non-finite throws", () => {
  assertThrows(() => calcProfit({ sellPrice: NaN, cost: 10, pkgCost: 0, shipCost: 0, ebayFee: 13 }));
  assertThrows(() => calcProfit({ sellPrice: Infinity, cost: 10, pkgCost: 0, shipCost: 0, ebayFee: 13 }));
});

// P3-34: bring this Deno mirror's test matrix to parity with
// packages/shared/src/utils/calcProfit.test.ts (the canonical version's
// suite) — same fixtures, same expected outputs — since a real cross-repo
// import to run one shared test file against both isn't safe yet (see
// financialEngine.ts's header comment).

Deno.test("ebayFee is configurable — fee 0 produces zero eBay fees (never hardcoded)", () => {
  const r = calcProfit({ sellPrice: 100, cost: 20, pkgCost: 1.25, shipCost: 6, ebayFee: 0 });
  assertEquals(r.ebayFees, 0);
  assertEquals(r.net, 72.75);
});

Deno.test("invalid input — negative sellPrice throws", () => {
  assertThrows(() => calcProfit({ sellPrice: -1, cost: 10, pkgCost: 0, shipCost: 0, ebayFee: 13 }));
});

Deno.test("invalid input — negative ebayFee throws", () => {
  assertThrows(() => calcProfit({ sellPrice: 50, cost: 10, pkgCost: 0, shipCost: 0, ebayFee: -1 }));
});

Deno.test("edge — zero sellPrice: margin guarded to 0 (no division by zero)", () => {
  const r = calcProfit({ sellPrice: 0, cost: 10, pkgCost: 1.25, shipCost: 6, ebayFee: 13 });
  assertEquals(r.margin, 0);
});

Deno.test("buyer-paid shipping (shipCost 0) vs seller-paid shipping (shipCost > 0) changes net identically to the canonical version", () => {
  const buyerPays = calcProfit({ sellPrice: 100, cost: 20, pkgCost: 1.25, shipCost: 0, ebayFee: 13 });
  const sellerPays = calcProfit({ sellPrice: 100, cost: 20, pkgCost: 1.25, shipCost: 6, ebayFee: 13 });
  assertEquals(buyerPays.net, 65.75);
  assertEquals(sellerPays.net, 59.75);
  assertEquals(buyerPays.net - sellerPays.net, 6);
});

Deno.test("custom packaging cost changes net by exactly the delta", () => {
  const r = calcProfit({ sellPrice: 100, cost: 20, pkgCost: 5, shipCost: 6, ebayFee: 13 });
  assertEquals(r.pkgCost, 5);
  assertEquals(r.net, 56);
});

Deno.test("currency rounding — results rounded to 2 decimals", () => {
  const r = calcProfit({ sellPrice: 33.33, cost: 10, pkgCost: 0, shipCost: 0, ebayFee: 13 });
  assertEquals(Number.isInteger(r.net * 100), true);
  assertEquals(Number.isInteger(r.ebayFees * 100), true);
});
