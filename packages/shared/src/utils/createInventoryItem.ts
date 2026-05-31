import type { InventoryItem, ItemCondition, SourcingMeta } from '../types'
import { CATEGORY_SKU_PREFIX } from '../constants/categories'

export interface CreateItemInput {
  nickname: string
  category: string
  condition?: ItemCondition
  cost: number
  sellPrice?: number | null
  platform?: string
  notes?: string | null
  photos?: string[]
  createdFrom?: string
  sourcingMeta?: SourcingMeta | null
}

export type InventoryPayload = Omit<InventoryItem,
  'id' | 'userId' | 'sku' | 'createdAt' | 'updatedAt' |
  'listedAt' | 'soldAt' | 'ebayItemId' | 'listingData' | 'photoCount'
>

// Pure function — builds the item shape. DB write + SKU generation happen server-side.
// All three callers (BUY IT from Scout, shelf BUY, manual Add Item) must use this.
export function buildInventoryPayload(input: CreateItemInput): InventoryPayload {
  return {
    nickname: input.nickname.trim() || null,
    category: input.category,
    condition: input.condition ?? 'Used',
    cost: Math.max(0, input.cost),
    sellPrice: input.sellPrice ?? null,
    status: 'Unlisted',
    platform: input.platform ?? 'eBay',
    notes: input.notes?.trim() ?? null,
    photos: input.photos ?? [],
    createdFrom: input.createdFrom ?? 'manual',
    sourcingMeta: input.sourcingMeta ?? null,
  }
}

export function skuPrefix(category: string): string {
  return CATEGORY_SKU_PREFIX[category] ?? 'OTH_'
}
