// Core domain types for ScanForProfit

export type UserTier = 'trial' | 'scout' | 'hustle' | 'stack' | 'empire'

export type ItemCondition =
  | 'New'
  | 'Like New'
  | 'Open Box'
  | 'Good'
  | 'Used'
  | 'Fair'
  | 'Poor'

export type ItemStatus =
  | 'Unlisted'
  | 'Listed'
  | 'Sold'
  | 'Ready to Export'

export type SourcingStyle = 'conservative' | 'balanced' | 'aggressive'

export type ScanDecision = 'HOT' | 'LIST' | 'SKIP'

export interface SourcingMeta {
  avgSoldPrice: number
  priceLow: number
  priceHigh: number
  sellThroughRate: number
  avgDaysToSell: number
  demandLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH'
  confidence: number
  confidenceReason: string
  searchKeywords: string[]
  listingTips: string[]
  riskFlags: string[]
  notes: string
}

export interface ListingData {
  title: string           // max 80 chars
  description: string     // 250-400 words
  conditionNote: string   // 50-100 words
  ebayCategory: string
  ebayCategoryId: number | null
  ebayConditionId: string | null
  generatedAt: string
}

export interface InventoryItem {
  id: number
  userId: number
  sku: string | null
  nickname: string | null
  category: string | null
  condition: ItemCondition | null
  cost: number | null
  sellPrice: number | null
  status: ItemStatus
  platform: string
  photos: string[]
  notes: string | null
  sourcingMeta: SourcingMeta | null
  listingData: ListingData | null
  ebayItemId: string | null
  photoCount: number
  createdFrom: string | null
  listedAt: string | null
  soldAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ScanLog {
  id: number
  userId: number
  createdAt: string
  scanType: 'single' | 'shelf'
  itemName: string | null
  itemDescription: string | null
  decision: ScanDecision | null
  estimatedProfit: number | null
  potentialProfit: number | null
  estimatedSell: number | null
  cost: number | null
  roi: number | null
  bought: boolean
  category: string | null
  confidence: number | null
  rawResponse: unknown
}

export interface UserSettings {
  id: number
  userId: number
  ebayFee: number         // never hardcoded, always from settings
  pkgCost: number         // default 1.25
  minProfit: number       // default 15
  targetRoi: number       // default 200
  maxDays: number         // default 60 (stale_days)
  minStr: number          // default 0
  shipping: string        // 'buyer' | 'seller'
  shipCost: number        // default 6.00
  sourcingStyle: SourcingStyle
  taxReservePct: number   // default 0.25, never hardcoded
  mileageRate: number     // default 0.67 IRS rate, never hardcoded
  updatedAt: string
}

export interface GrowthAnalysis {
  businessScore: number
  scoreLabel: 'Strong' | 'Growing' | 'Steady' | 'Needs Attention'
  scoreColor: string
  scoreSummary: string
  topCategories: Array<{
    name: string
    profit: number
    soldCount: number
    insight: string
  }>
  staleActions: Array<{
    sku: string
    nickname: string
    daysListed: number
    action: 'relist' | 'drop_price' | 'bundle' | 'donate'
    suggestion: string
  }>
  huntList: Array<{
    item: string
    priority: 'HIGH' | 'MED'
    reason: string
  }>
  marketTrends: Array<{
    category: string
    direction: 'up' | 'down'
    reasoning: string
  }>
  advisorMessage: string
}

// Snake_case interface matching the AI prompt output from FEATURE_TRIAGE F-27
export interface GrowthReport {
  business_score: number                       // 0-100
  score_label: 'Strong' | 'Growing' | 'Steady' | 'Needs Attention'
  score_color: string
  score_summary: string
  top_categories: {
    name: string
    profit: number
    sold_count: number
    insight: string
  }[]
  stale_actions: {
    sku: string
    nickname: string
    days_listed: number
    action: 'relist' | 'drop_price' | 'bundle' | 'donate'
    suggestion: string
  }[]
  hunt_list: {
    item: string
    priority: 'HIGH' | 'MED'
    reason: string
    icon?: string
  }[]
  market_trends: {
    category: string
    direction: 'up' | 'down'
    reasoning: string
  }[]
  advisor_message: string
  generatedAt: string
  item_count: number     // total items in inventory at generation time
}

// P&L types — port from ScanForProfit_v5_24.html
export interface PnlSummary {
  totalRevenue: number        // sum of sold items sell_price
  totalCogs: number           // sum of sold items cost
  totalFees: number           // ebayFee applied to each sale
  totalShipping: number       // shipping costs paid (seller-pays mode only)
  totalPackaging: number      // pkgCost per sold item
  totalExpenses: number       // from pnl_expenses table
  totalMileage: number        // miles * mileageRate (from settings — NEVER hardcode 0.67)
  netProfit: number           // revenue - cogs - fees - shipping - packaging - expenses - mileage
  taxReserve: number          // netProfit * taxReservePct — informational only, not deducted
  roi: number                 // (netProfit / totalCogs) * 100
  avgDaysToSell: number
  itemsSold: number
  itemsListed: number
  itemsUnlisted: number
  periodLabel: string         // "This Month" | "Last 30 Days" | "All Time"
}

export interface PnlExpense {
  id: number
  userId: number
  amount: number
  description: string | null
  category: 'supplies' | 'mileage' | 'storage' | 'other'
  expenseDate: string         // UTC ISO 8601
  miles: number | null
  createdAt: string
}

export interface GrowthCache {
  id: number
  userId: number
  cacheData: GrowthAnalysis
  generatedAt: string
  expiresAt: string
}

export const TIER_LIMITS: Record<UserTier, {
  scans: number | 'unlimited'
  items: number | 'unlimited'
}> = {
  trial:  { scans: 'unlimited', items: 'unlimited' },
  scout:  { scans: 25,          items: 10 },
  hustle: { scans: 'unlimited', items: 500 },
  stack:  { scans: 'unlimited', items: 'unlimited' },
  empire: { scans: 'unlimited', items: 'unlimited' },
}

// AI-generated eBay listing draft
export interface ListingDraft {
  itemId: number | null
  title: string           // ≤80 chars — eBay hard limit
  description: string     // ≥150 chars
  conditionNote: string
  suggestedPrice: number | null
  keywords: string[]      // 5–10 keywords
  ebayCategory: string | null
  shippingNote: string | null
  generatedAt: string
}

export interface TrendingKeyword {
  rank: number
  word: string
  trend: 'up' | 'stable' | 'down'
  bar: number             // 0–100 relative search volume
}

export interface TrendingKeywordsResult {
  keywords: TrendingKeyword[]
  trending_categories: string[]
  hot_tip: string
  fromCache: boolean
}

// Mutable settings fields — used when saving user preferences
export interface SettingsInput {
  ebayFee: number
  pkgCost: number
  shipCost: number
  minProfit: number
  targetRoi: number
  maxDays: number
  minStr: number
  sourcingStyle: SourcingStyle
  shipping: string   // 'buyer' | 'seller'
}

// Used by calcProfit.ts
export interface ProfitCalcResult {
  gross: number
  ebayFees: number
  pkgCost: number
  shipCost: number
  totalFees: number   // pkgCost + shipCost + ebayFees
  net: number
  roi: number         // (net / cost) * 100
  margin: number      // (net / gross) * 100
}
