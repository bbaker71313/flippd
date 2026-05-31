import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { supabase } from './supabase'
import type { ListingDraft, TrendingKeywordsResult, ItemCondition, InventoryItem } from '@sfp/shared'

function getProxyUrl(): string {
  return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/claude-proxy`
}

async function callProxy(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Session expired. Please sign in again.')
  const res = await fetch(getProxyUrl(), {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error((d.error as string) ?? `Server error (${res.status})`)
  }
  return res.json()
}

export async function generateListing(
  item: InventoryItem,
): Promise<ListingDraft> {
  const result = await callProxy({
    type:      'listing_generate',
    itemId:    item.id,
    nickname:  item.nickname ?? '',
    category:  item.category ?? 'Other',
    condition: item.condition ?? 'Used',
    cost:      item.cost ?? 0,
    sellPrice: item.sellPrice,
    notes:     item.notes ?? '',
    platform:  item.platform ?? 'eBay',
  })
  return result.listing as ListingDraft
}

export async function fetchKeywords(): Promise<TrendingKeywordsResult> {
  const result = await callProxy({ type: 'keywords_get' })
  return result as unknown as TrendingKeywordsResult
}

export async function markAsListed(itemId: number): Promise<void> {
  await callProxy({ type: 'inventory_status', id: itemId, status: 'Listed' })
}

// eBay condition ID map for CSV — verbatim from FEATURE_TRIAGE.md F-30 / P-13
const CSV_CONDITION_ID: Record<string, string> = {
  'New':        'NEW',
  'Like New':   'NEW_OTHER',
  'Open Box':   'NEW_OTHER',
  'Good':       'USED',
  'Used':       'USED',
  'Fair':       'USED',
  'Poor':       'FOR_PARTS_OR_NOT_WORKING',
}

function escCsv(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

// eBay standard CSV — column order verbatim from FEATURE_TRIAGE.md F-30
export async function exportCsv(item: InventoryItem, draft: ListingDraft): Promise<void> {
  const headers = [
    'Action','Title','UPC','EAN','ISBN','Category','Price','BuyItNowPrice','Quantity',
    'ConditionID','ConditionDescription','Description','Format','Duration',
    'ShippingService-1:Option','ShippingService-1:Cost','Location',
    'SiteID','Currency','PaymentProfileName',
  ]

  const conditionId = CSV_CONDITION_ID[item.condition ?? 'Used'] ?? 'USED'
  const price = draft.suggestedPrice != null ? draft.suggestedPrice.toFixed(2) : ''

  const row = [
    'Add',
    draft.title,
    '', '', '',
    draft.ebayCategory ?? item.category ?? '',
    price,
    price,
    '1',
    conditionId,
    draft.conditionNote,
    draft.description,
    'FixedPrice',
    'GTC',
    'ShippingMethodStandard',
    '0',
    'United States',
    'US',
    'USD',
    '',
  ]

  const csv = `Version=0.0.2\n${headers.join(',')}\n${row.map(escCsv).join(',')}\n`

  const filename = `${(item.sku ?? `item-${item.id}`)}-listing.csv`
  const file = new File(Paths.cache, filename)
  file.write(csv)

  const canShare = await Sharing.isAvailableAsync()
  if (!canShare) throw new Error('Sharing not available on this device')
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export eBay listing CSV' })
}
