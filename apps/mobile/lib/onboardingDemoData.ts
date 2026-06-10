import type { ScanResultProps } from "../components/ui/ScanResult";

// Mirrors the "Vintage Cast Iron Skillet" mockup on the marketing homepage,
// for narrative consistency between the website and the in-app first scan.
export const DEMO_SCAN_RESULT: Omit<ScanResultProps, "onBuy" | "onPass"> = {
  decision: "BUY",
  itemName: "Vintage Cast Iron Skillet",
  cost: 4.0,
  estimatedSell: 47.0,
  estimatedProfit: 38.5,
  roi: 962,
  confidence: 92,
  reasoning:
    "12 sold in the last 90 days. Consistent demand for vintage cast iron cookware.",
};

export const DEMO_SOLD_RANGE = "$38–$52";
export const DEMO_AVG_DAYS_TO_SELL = 9;
