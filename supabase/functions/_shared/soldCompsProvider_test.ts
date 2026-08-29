// Runtime tests for the live-verified SoldComps response parsing.
// Run: `deno test supabase/functions/_shared/`
// Fixture below is the real (sanitized) shape confirmed live 2026-08-26 —
// see soldCompsProvider.ts file header for how it was obtained.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseSoldComp, parseTrawlSoldComp } from "./soldCompsProvider.ts";

const LIVE_RECORD = {
  itemId: "377417007385",
  url: "https://www.ebay.com/itm/377417007385?nordt=true",
  thumbnailUrl: "https://i.ebayimg.com/images/g/268AAeSwiX5qfp0T/s-l225.jpg",
  fullResThumbnailUrl: "https://i.ebayimg.com/images/g/268AAeSwiX5qfp0T/s-l500.jpg",
  epid: "14039799782",
  title: "Jordan Air Jordan 1 Mid SE Patent Black/White/Gold 852542-007",
  condition: "Brand New",
  conditionId: 1000,
  sellerType: null,
  buyingFormat: null,
  bestOfferAccepted: true,
  acceptsOffers: true,
  bidCount: null,
  categoryId: "15709",
  listingType: "sold",
  endedAt: "2026-08-26",
  soldPrice: "81",
  soldCurrency: "USD",
  shippingPrice: "14.95",
  shippingCurrency: "USD",
  shippingType: "paid",
  totalPrice: "95.95",
  sellerUsername: "nameblayne18",
  sellerPositivePercent: 90.9,
  sellerFeedbackScore: 18,
  itemLocation: "United States",
  scrapedAt: "2026-08-26T19:14:45.378Z",
};

Deno.test("live-verified record — numeric-string prices are coerced to numbers", () => {
  const parsed = parseSoldComp(LIVE_RECORD);
  if (!parsed) throw new Error("expected a parsed comp");
  assertEquals(parsed.soldPrice, 81);
  assertEquals(parsed.totalPrice, 95.95);
  assertEquals(parsed.shippingPrice, 14.95);
});

Deno.test("live-verified record — conditionId (number) becomes a string", () => {
  const parsed = parseSoldComp(LIVE_RECORD);
  assertEquals(parsed?.conditionId, "1000");
});

Deno.test("live-verified record — url field maps to listingUrl", () => {
  const parsed = parseSoldComp(LIVE_RECORD);
  assertEquals(parsed?.listingUrl, "https://www.ebay.com/itm/377417007385?nordt=true");
});

Deno.test("live-verified record — sellerPositivePercent maps to sellerFeedbackPercent", () => {
  const parsed = parseSoldComp(LIVE_RECORD);
  assertEquals(parsed?.sellerFeedbackPercent, 90.9);
});

Deno.test("live-verified record — soldCurrency maps to currency", () => {
  const parsed = parseSoldComp(LIVE_RECORD);
  assertEquals(parsed?.currency, "USD");
});

Deno.test("live-verified record — date-only endedAt is preserved as valid ISO", () => {
  const parsed = parseSoldComp(LIVE_RECORD);
  assertEquals(parsed?.endedAt, new Date("2026-08-26").toISOString());
});

Deno.test("live-verified record — bestOfferAccepted evidence is preserved, not dropped", () => {
  const parsed = parseSoldComp(LIVE_RECORD);
  assertEquals(parsed?.bestOfferAccepted, true);
});

Deno.test("a numeric-string soldPrice of \"0\" is rejected, not coerced to a usable comp", () => {
  const parsed = parseSoldComp({ ...LIVE_RECORD, soldPrice: "0" });
  assertEquals(parsed, null);
});

Deno.test("a non-numeric soldPrice string is rejected, never fabricated as 0 or NaN", () => {
  const parsed = parseSoldComp({ ...LIVE_RECORD, soldPrice: "call for price" });
  assertEquals(parsed, null);
});

Deno.test("missing itemId is rejected", () => {
  const { itemId: _itemId, ...rest } = LIVE_RECORD;
  assertEquals(parseSoldComp(rest), null);
});

Deno.test("non-object input is rejected, not thrown on", () => {
  assertEquals(parseSoldComp(null), null);
  assertEquals(parseSoldComp("not an object"), null);
  assertEquals(parseSoldComp(42), null);
});

Deno.test("a record with only 1 valid comp still parses (low comp count is a stats-layer concern, not a parse failure)", () => {
  const parsed = parseSoldComp(LIVE_RECORD);
  if (!parsed) throw new Error("expected a parsed comp");
  assertEquals(typeof parsed.soldPrice, "number");
});

const TRAWL_RECORD = {
  title: "Apple iPhone 15 Pro 256GB Unlocked",
  sale_price: 525,
  shipping_price: 12.99,
  currency: "$",
  condition: "used",
  condition_raw: "Pre-Owned",
  date_sold: "2026-07-18T00:00:00.000Z",
  buying_format: "Buy It Now",
  item_id: "256637082114",
  item_link: "https://www.ebay.com/itm/256637082114",
};

Deno.test("Trawl record maps final sold price, shipping, currency, and URL", () => {
  const parsed = parseTrawlSoldComp(TRAWL_RECORD);
  assertEquals(parsed?.itemId, "256637082114");
  assertEquals(parsed?.soldPrice, 525);
  assertEquals(parsed?.shippingPrice, 12.99);
  assertEquals(parsed?.totalPrice, 537.99);
  assertEquals(parsed?.currency, "USD");
  assertEquals(parsed?.condition, "Pre-Owned");
  assertEquals(parsed?.listingUrl, "https://www.ebay.com/itm/256637082114");
});

Deno.test("Trawl malformed or zero-price records are rejected", () => {
  assertEquals(parseTrawlSoldComp({ ...TRAWL_RECORD, sale_price: 0 }), null);
  assertEquals(parseTrawlSoldComp({ ...TRAWL_RECORD, date_sold: "not-a-date" }), null);
  assertEquals(parseTrawlSoldComp({ ...TRAWL_RECORD, item_id: null }), null);
});
