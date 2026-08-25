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
});
