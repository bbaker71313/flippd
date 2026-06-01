import type { InventoryItem, PnlExpense, PnlSummary, UserSettings } from '../types'

// Port from Flippd pnlCalc() L3028 — all values from settings, never hardcoded
export function calcPnl(
  soldItems: InventoryItem[],
  allItems: InventoryItem[],
  expenses: PnlExpense[],
  settings: Pick<UserSettings, 'ebayFee' | 'pkgCost' | 'shipping' | 'shipCost' | 'taxReservePct' | 'mileageRate'>,
  periodLabel: string,
): PnlSummary {
  const { ebayFee, pkgCost, shipping, shipCost, taxReservePct, mileageRate } = settings

  // Revenue and cost from sold items
  let totalRevenue   = 0
  let totalCogs      = 0
  let totalFees      = 0
  let totalPackaging = 0
  let totalShipping  = 0

  for (const item of soldItems) {
    const sell = item.sellPrice ?? 0
    const cost = item.cost      ?? 0
    totalRevenue   += sell
    totalCogs      += cost
    totalFees      += sell * (ebayFee / 100)
    totalPackaging += pkgCost
    // Seller pays shipping per item
    if (shipping === 'seller') totalShipping += shipCost
  }

  // Expenses from pnl_expenses — mileage is separate
  let totalExpenses = 0
  let totalMiles    = 0
  for (const exp of expenses) {
    if (exp.category === 'mileage' && exp.miles != null) {
      totalMiles += exp.miles
    } else {
      totalExpenses += exp.amount
    }
  }
  const totalMileage = totalMiles * mileageRate  // never hardcode 0.67

  const netProfit = round2(
    totalRevenue - totalCogs - totalFees - totalPackaging - totalShipping - totalExpenses - totalMileage,
  )
  const taxReserve = netProfit > 0 ? round2(netProfit * taxReservePct) : 0  // never hardcode 0.25
  const roi        = totalCogs > 0 ? round2((netProfit / totalCogs) * 100) : 0

  const itemsSold     = soldItems.length
  const itemsListed   = allItems.filter(i => i.status === 'Listed').length
  const itemsUnlisted = allItems.filter(i => i.status === 'Unlisted').length

  // Average days to sell (sold_at - created_at)
  const daysArr = soldItems
    .filter(i => i.soldAt && i.createdAt)
    .map(i => Math.max(0, (new Date(i.soldAt!).getTime() - new Date(i.createdAt).getTime()) / 86400000))
  const avgDaysToSell = daysArr.length > 0
    ? round2(daysArr.reduce((a, b) => a + b, 0) / daysArr.length)
    : 0

  return {
    totalRevenue:   round2(totalRevenue),
    totalCogs:      round2(totalCogs),
    totalFees:      round2(totalFees),
    totalShipping:  round2(totalShipping),
    totalPackaging: round2(totalPackaging),
    totalExpenses:  round2(totalExpenses),
    totalMileage:   round2(totalMileage),
    netProfit,
    taxReserve,
    roi,
    avgDaysToSell,
    itemsSold,
    itemsListed,
    itemsUnlisted,
    periodLabel,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
