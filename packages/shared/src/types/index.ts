// Core domain types for ScanForProfit — aligned to Flippd data model

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

export type ScanDecision = 'BUY' | 'HOT' | 'PASS'

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
