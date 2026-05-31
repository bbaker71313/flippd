import { supabase } from './supabase'
import type { InventoryItem } from '@sfp/shared'
import { buildInventoryPayload, type CreateItemInput } from '@sfp/shared'

export type { CreateItemInput }

export type ProxySettings = {
  ebay_fee: number
  pkg_cost: number
  ship_cost: number
  target_roi: number
  min_profit: number
  sourcing_style: string
}

export type InventoryListResult = {
  items: InventoryItem[]
  itemCount: number
  settings: ProxySettings
  tier: string
}

export type UpdateItemInput = Partial<Pick<CreateItemInput,
  'nickname' | 'category' | 'condition' | 'cost' | 'sellPrice' | 'platform' | 'notes' | 'photos'
>> & { id: number; photoCount?: number }

function getProxyUrl(): string {
  return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/claude-proxy`
}

async function callProxy(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Session expired. Please sign in again.')

  const res = await fetch(getProxyUrl(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (res.status === 429) {
    const data = await res.json()
    const err = Object.assign(new Error(data.error ?? 'limit_reached'), {
      isLimitError: true,
      limitData: data as { tier: string; limit: number },
    })
    throw err
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error((data.error as string) ?? `Server error (${res.status})`)
  }

  return res.json()
}

function mapRow(row: Record<string, unknown>): InventoryItem {
  const photosRaw = row.photos
  let photos: string[] = []
  if (Array.isArray(photosRaw)) {
    photos = photosRaw as string[]
  } else if (typeof photosRaw === 'string') {
    try { photos = JSON.parse(photosRaw) } catch { photos = [] }
  }

  return {
    id:           row.id as number,
    userId:       row.user_id as number,
    sku:          row.sku as string | null,
    nickname:     row.nickname as string | null,
    category:     row.category as string | null,
    condition:    row.condition as InventoryItem['condition'],
    cost:         row.cost != null ? Number(row.cost) : null,
    sellPrice:    row.sell_price != null ? Number(row.sell_price) : null,
    status:       (row.status as InventoryItem['status']) ?? 'Unlisted',
    platform:     (row.platform as string) ?? 'eBay',
    photos,
    notes:        row.notes as string | null,
    sourcingMeta: row.sourcing_meta as InventoryItem['sourcingMeta'] ?? null,
    listingData:  row.listing_data as InventoryItem['listingData'] ?? null,
    ebayItemId:   row.ebay_item_id as string | null,
    photoCount:   (row.photo_count as number) ?? photos.length,
    createdFrom:  row.created_from as string | null,
    listedAt:     row.listed_at as string | null,
    soldAt:       row.sold_at as string | null,
    createdAt:    row.created_at as string,
    updatedAt:    (row.updated_at as string) ?? (row.created_at as string),
  }
}

export async function fetchInventory(): Promise<InventoryListResult> {
  const result = await callProxy({ type: 'inventory_list' })
  return {
    items:      ((result.items as unknown[]) ?? []).map(r => mapRow(r as Record<string, unknown>)),
    itemCount:  (result.itemCount as number) ?? 0,
    settings:   (result.settings as ProxySettings),
    tier:       (result.tier as string) ?? 'trial',
  }
}

export async function createItem(input: CreateItemInput): Promise<InventoryItem> {
  const payload = buildInventoryPayload(input)
  const result = await callProxy({ type: 'inventory_create', ...payload, sellPrice: payload.sellPrice, createdFrom: input.createdFrom ?? 'manual' })
  return mapRow(result.item as Record<string, unknown>)
}

export async function updateItem(input: UpdateItemInput): Promise<InventoryItem> {
  const result = await callProxy({ type: 'inventory_update', ...input })
  return mapRow(result.item as Record<string, unknown>)
}

export async function deleteItem(id: number): Promise<void> {
  await callProxy({ type: 'inventory_delete', id })
}

export async function changeStatus(
  id: number,
  status: InventoryItem['status'],
  actualSellPrice?: number,
): Promise<InventoryItem> {
  const result = await callProxy({ type: 'inventory_status', id, status, actualSellPrice })
  return mapRow(result.item as Record<string, unknown>)
}
