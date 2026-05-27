import type { ProfitCalcResult } from "../types";

export interface CalcProfitInput {
  sellPrice: number
  cost: number
  pkgCost: number
  shipCost: number
  // Never hardcode eBay fee — always passed in from UserSettings.ebayFee
  ebayFee: number
}

export function calcProfit(input: CalcProfitInput): ProfitCalcResult {
  const { sellPrice, cost, pkgCost, shipCost, ebayFee } = input

  const ebayFees  = sellPrice * (ebayFee / 100)
  const totalFees = pkgCost + shipCost + ebayFees
  const totalCost = cost + totalFees
  const net       = sellPrice - totalCost
  const roi       = cost > 0 ? (net / cost) * 100 : 0
  const margin    = sellPrice > 0 ? (net / sellPrice) * 100 : 0

  return {
    gross:      sellPrice,
    ebayFees:   round2(ebayFees),
    pkgCost:    round2(pkgCost),
    shipCost:   round2(shipCost),
    totalFees:  round2(totalFees),
    net:        round2(net),
    roi:        round2(roi),
    margin:     round2(margin),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
