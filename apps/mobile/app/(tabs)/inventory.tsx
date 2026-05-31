import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ActivityIndicator, Alert, FlatList, Image, Modal,
  RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ItemCard } from '../../components/ui/ItemCard'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { ProfitBadge } from '../../components/ui/ProfitBadge'
import {
  COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS, TIER_LIMITS,
  calcProfit, EBAY_CATEGORIES,
} from '@sfp/shared'
import type { InventoryItem, ItemStatus, ItemCondition, UserTier } from '@sfp/shared'
import {
  fetchInventory, createItem, updateItem, deleteItem, changeStatus,
  type InventoryListResult, type UpdateItemInput,
} from '../../lib/inventory'
import { pickAndCompressPhoto, uploadItemPhoto, MAX_PHOTOS } from '../../lib/storage'

type StatusFilter = 'ALL' | ItemStatus
interface FormState {
  nickname: string; category: string; condition: ItemCondition
  cost: string; sellPrice: string; platform: string; notes: string; photos: string[]
}
const EMPTY_FORM: FormState = {
  nickname: '', category: 'Consumer Electronics', condition: 'Used',
  cost: '', sellPrice: '', platform: 'eBay', notes: '', photos: [],
}
const CONDITIONS: ItemCondition[] = ['New', 'Like New', 'Open Box', 'Good', 'Used', 'Fair', 'Poor']

const STATUS_FILTER_LABELS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'ALL' }, { key: 'Unlisted', label: 'UNLISTED' },
  { key: 'Listed', label: 'LISTED' }, { key: 'Sold', label: 'SOLD' },
]
const STATUS_PILL: Record<ItemStatus, { bg: string; text: string }> = {
  Unlisted:          { bg: COLORS.warning + '22', text: COLORS.warningText },
  Listed:            { bg: COLORS.brand + '22',   text: COLORS.brandDim },
  Sold:              { bg: COLORS.border,          text: COLORS.textMuted },
  'Ready to Export': { bg: COLORS.warning + '22', text: COLORS.warningText },
}
const inputSty = {
  backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
  borderWidth: 1, borderColor: COLORS.border,
  paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize,
  color: COLORS.textPrimary,
} as const
const selectSty = {
  backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, borderWidth: 1,
  borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  flexDirection: 'row' as const, alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
}
function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: SPACING.md }}>
      <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  )
}

function DR({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
      <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted }}>{label}</Text>
      <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize - 1, color: COLORS.textPrimary, flex: 1, textAlign: 'right' }} numberOfLines={2}>{value}</Text>
    </View>
  )
}
function DStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, marginBottom: 4 }}>{label}</Text>
      {value}
    </View>
  )
}
function SBtn({ label, onPress, color, bg }: { label: string; onPress: () => void; color: string; bg: string }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: bg, alignItems: 'center' }}>
      <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color }}>{label}</Text>
    </TouchableOpacity>
  )
}

export default function InventoryScreen() {
  const [data, setData]               = useState<InventoryListResult | null>(null)
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [query, setQuery]             = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [sheetVisible, setSheetVisible]     = useState(false)
  const [editItem, setEditItem]             = useState<InventoryItem | null>(null)
  const [detailItem, setDetailItem]         = useState<InventoryItem | null>(null)
  const [deleteTarget, setDeleteTarget]     = useState<InventoryItem | null>(null)
  const [soldTarget, setSoldTarget]         = useState<InventoryItem | null>(null)
  const [soldPrice, setSoldPrice]           = useState('')
  const [pickerField, setPickerField]       = useState<'category' | 'condition' | null>(null)
  const [form, setForm]                     = useState<FormState>(EMPTY_FORM)
  const [formLoading, setFormLoading]       = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try { setData(await fetchInventory()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load inventory') }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const filteredItems = useMemo(() => {
    if (!data) return []
    let items = data.items
    if (statusFilter !== 'ALL') items = items.filter(i => i.status === statusFilter)
    if (query.trim()) {
      const q = query.toLowerCase()
      items = items.filter(i =>
        (i.nickname ?? '').toLowerCase().includes(q) ||
        (i.sku ?? '').toLowerCase().includes(q) ||
        (i.category ?? '').toLowerCase().includes(q))
    }
    return items
  }, [data, statusFilter, query])

  function checkTierLimit(): boolean {
    if (!data) return false
    const limit = TIER_LIMITS[data.tier as UserTier]?.items
    if (typeof limit === 'number' && data.itemCount >= limit) {
      Alert.alert('Inventory Full', `Your ${data.tier} plan allows ${limit} items. Upgrade to add more.`,
        [{ text: 'Not Now', style: 'cancel' }, { text: 'Upgrade', onPress: () => {} }])
      return true
    }
    return false
  }

  function initForm(item?: InventoryItem) {
    if (item) {
      setForm({ nickname: item.nickname ?? '', category: item.category ?? 'Consumer Electronics',
        condition: item.condition ?? 'Used', cost: item.cost != null ? String(item.cost) : '',
        sellPrice: item.sellPrice != null ? String(item.sellPrice) : '',
        platform: item.platform ?? 'eBay', notes: item.notes ?? '', photos: [...item.photos] })
    } else { setForm(EMPTY_FORM) }
  }

  function liveProfit() {
    const cost = parseFloat(form.cost); const sell = parseFloat(form.sellPrice)
    if (!isNaN(cost) && !isNaN(sell) && cost > 0 && sell > 0 && data?.settings) {
      const s = data.settings
      return calcProfit({ sellPrice: sell, cost, pkgCost: s.pkg_cost, shipCost: s.ship_cost, ebayFee: s.ebay_fee })
    }
    return null
  }

  async function handleAddPhoto() {
    if (form.photos.length >= MAX_PHOTOS) { Alert.alert('Max photos', `Up to ${MAX_PHOTOS} photos per item.`); return }
    setPhotoUploading(true)
    try {
      const picked = await pickAndCompressPhoto()
      if (!picked) return
      if (editItem && data) {
        const url = await uploadItemPhoto(editItem.userId, editItem.id, picked.uri)
        setForm(f => ({ ...f, photos: [...f.photos, url] }))
      } else {
        setForm(f => ({ ...f, photos: [...f.photos, picked.uri] }))
      }
    } catch (e) { Alert.alert('Photo error', e instanceof Error ? e.message : 'Could not add photo') }
    finally { setPhotoUploading(false) }
  }

  async function handleSubmit() {
    const nickname = form.nickname.trim()
    if (!nickname) { Alert.alert('Missing field', 'Item name is required.'); return }
    const cost = parseFloat(form.cost)
    if (isNaN(cost) || cost < 0) { Alert.alert('Invalid cost', 'Enter a valid cost (e.g. 2.50)'); return }
    setFormLoading(true)
    try {
      if (editItem) {
        const updated = await updateItem({ id: editItem.id, nickname, category: form.category,
          condition: form.condition, cost, sellPrice: parseFloat(form.sellPrice) || null,
          platform: form.platform, notes: form.notes || null, photos: form.photos,
          photoCount: form.photos.length } as UpdateItemInput)
        setData(d => d ? { ...d, items: d.items.map(i => i.id === updated.id ? updated : i) } : d)
        setDetailItem(updated)
      } else {
        const created = await createItem({ nickname, category: form.category, condition: form.condition,
          cost, sellPrice: parseFloat(form.sellPrice) || null, platform: form.platform,
          notes: form.notes || null, photos: [], createdFrom: 'manual' })
        let finalItem = created
        if (form.photos.length > 0 && data) {
          const urls: string[] = []
          for (const uri of form.photos) {
            try { urls.push(await uploadItemPhoto(created.userId, created.id, uri)) } catch { /* skip */ }
          }
          if (urls.length > 0) {
            finalItem = await updateItem({ id: created.id, photos: urls, photoCount: urls.length } as UpdateItemInput)
          }
        }
        setData(d => d ? { ...d, items: [finalItem, ...d.items], itemCount: d.itemCount + 1 } : d)
      }
      setSheetVisible(false)
    } catch (e: unknown) {
      Alert.alert('Error', (e instanceof Error ? e.message : null) ?? 'Could not save item.')
    } finally { setFormLoading(false) }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteItem(deleteTarget.id)
      setData(d => d ? { ...d, items: d.items.filter(i => i.id !== deleteTarget.id), itemCount: d.itemCount - 1 } : d)
      setDetailItem(null)
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete item.') }
    finally { setDeleteTarget(null) }
  }

  async function handleStatusChange(item: InventoryItem, newStatus: ItemStatus) {
    if (newStatus === 'Sold') {
      setSoldTarget(item); setSoldPrice(item.sellPrice != null ? String(item.sellPrice) : ''); return
    }
    try {
      const updated = await changeStatus(item.id, newStatus)
      setData(d => d ? { ...d, items: d.items.map(i => i.id === updated.id ? updated : i) } : d)
      if (detailItem?.id === updated.id) setDetailItem(updated)
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not change status.') }
  }

  async function handleConfirmSold() {
    if (!soldTarget) return
    const price = parseFloat(soldPrice)
    if (isNaN(price) || price < 0) { Alert.alert('Enter sale price', 'What did you sell it for?'); return }
    try {
      const updated = await changeStatus(soldTarget.id, 'Sold', price)
      setData(d => d ? { ...d, items: d.items.map(i => i.id === updated.id ? updated : i) } : d)
      if (detailItem?.id === updated.id) setDetailItem(updated)
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not mark as sold.') }
    finally { setSoldTarget(null) }
  }

  const profit = liveProfit()
  const CATEGORY_NAMES = EBAY_CATEGORIES.map(c => c.name)

  if (loading) return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={COLORS.brand} />
    </SafeAreaView>
  )
  if (error) return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl }}>
      <Text style={{ color: COLORS.lossText, fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, textAlign: 'center', marginBottom: SPACING.lg }}>{error}</Text>
      <TouchableOpacity onPress={() => void load()} style={{ backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md }}>
        <Text style={{ color: COLORS.elevated, fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize }}>RETRY</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background }}>

      {/* Header */}
      <View style={{ paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: TYPOGRAPHY.h2.fontFamily, fontSize: TYPOGRAPHY.h2.fontSize, fontWeight: TYPOGRAPHY.h2.fontWeight, color: COLORS.textPrimary }}>INVENTORY</Text>
        <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted }}>{data?.itemCount ?? 0} items</Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.sm }}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search items..." placeholderTextColor={COLORS.textMuted} style={inputSty} />
      </View>

      {/* Status filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.md }}
        contentContainerStyle={{ gap: SPACING.sm }}>
        {STATUS_FILTER_LABELS.map(({ key, label }) => {
          const active = statusFilter === key
          const colors = key !== 'ALL' ? STATUS_PILL[key as ItemStatus] : { bg: COLORS.brand + '22', text: COLORS.brandDim }
          return (
            <TouchableOpacity key={key} onPress={() => setStatusFilter(key)} style={{ paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.full, backgroundColor: active ? colors.bg : COLORS.surface, borderWidth: 1, borderColor: active ? colors.text : COLORS.border }}>
              <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color: active ? colors.text : COLORS.textMuted }}>{label}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* List */}
      <FlatList data={filteredItems} keyExtractor={item => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingBottom: 100, gap: SPACING.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true) }} tintColor={COLORS.brand} />}
        renderItem={({ item }) => <ItemCard item={item} onPress={() => setDetailItem(item)} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontFamily: TYPOGRAPHY.h3.fontFamily, fontSize: TYPOGRAPHY.h3.fontSize, color: COLORS.textMuted, marginBottom: SPACING.sm }}>No items</Text>
            <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, textAlign: 'center' }}>
              {query ? 'Try a different search.' : 'Tap ADD ITEM to start tracking.'}
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <View style={{ position: 'absolute', bottom: 24, right: 24 }}>
        <TouchableOpacity
          onPress={() => { if (checkTierLimit()) return; setEditItem(null); initForm(); setSheetVisible(true) }}
          style={{ backgroundColor: COLORS.brand, borderRadius: RADIUS.full, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, ...SHADOWS.md }}>
          <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color: COLORS.elevated }}>+ ADD ITEM</Text>
        </TouchableOpacity>
      </View>

      {/* ── Add / Edit BottomSheet ────────────────────────────────────────────── */}
      <BottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} title={editItem ? 'EDIT ITEM' : 'ADD ITEM'} snapPoint="80%">
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <FF label="ITEM NAME">
            <TextInput value={form.nickname} onChangeText={v => setForm(f => ({ ...f, nickname: v }))} placeholder="e.g. Vintage Levi 501" placeholderTextColor={COLORS.textMuted} style={inputSty} />
          </FF>
          <FF label="CATEGORY">
            <TouchableOpacity onPress={() => setPickerField('category')} style={selectSty}>
              <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textPrimary }}>{form.category}</Text>
              <Text style={{ color: COLORS.textMuted }}>›</Text>
            </TouchableOpacity>
          </FF>
          <FF label="CONDITION">
            <TouchableOpacity onPress={() => setPickerField('condition')} style={selectSty}>
              <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textPrimary }}>{form.condition}</Text>
              <Text style={{ color: COLORS.textMuted }}>›</Text>
            </TouchableOpacity>
          </FF>
          <View style={{ flexDirection: 'row', gap: SPACING.md }}>
            <View style={{ flex: 1 }}>
              <FF label="WHAT DID YOU PAY?">
                <TextInput value={form.cost} onChangeText={v => setForm(f => ({ ...f, cost: v }))} placeholder="0.00" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" style={inputSty} />
              </FF>
            </View>
            <View style={{ flex: 1 }}>
              <FF label="WHAT WILL YOU SELL FOR?">
                <TextInput value={form.sellPrice} onChangeText={v => setForm(f => ({ ...f, sellPrice: v }))} placeholder="0.00" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" style={inputSty} />
              </FF>
            </View>
          </View>

          {profit && (
            <View style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, flexDirection: 'row', justifyContent: 'space-between' }}>
              <DStat label="NET" value={<ProfitBadge amount={profit.net} size="md" showSign />} />
              <DStat label="ROI" value={<Text style={{ fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: TYPOGRAPHY.mono.fontSize, color: profit.roi > 0 ? COLORS.profitText : COLORS.lossText }}>{profit.roi.toFixed(0)}%</Text>} />
              <DStat label="FEES" value={<Text style={{ fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: TYPOGRAPHY.mono.fontSize, color: COLORS.textSecondary }}>${profit.totalFees.toFixed(2)}</Text>} />
            </View>
          )}

          <FF label="NOTES">
            <TextInput value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder="Optional notes..." placeholderTextColor={COLORS.textMuted} multiline numberOfLines={3} style={[inputSty, { height: 72, textAlignVertical: 'top' }]} />
          </FF>

          <FF label={`PHOTOS (${form.photos.length}/${MAX_PHOTOS})`}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                {form.photos.map((uri, idx) => (
                  <View key={idx} style={{ position: 'relative' }}>
                    <Image source={{ uri }} style={{ width: 64, height: 64, borderRadius: RADIUS.sm }} />
                    <TouchableOpacity onPress={() => setForm(f => ({ ...f, photos: f.photos.filter((_, i) => i !== idx) }))}
                      style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.inverse, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: COLORS.textInverse, fontSize: 11, fontWeight: '700' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {form.photos.length < MAX_PHOTOS && (
                  <TouchableOpacity onPress={handleAddPhoto} disabled={photoUploading}
                    style={{ width: 64, height: 64, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
                    {photoUploading ? <ActivityIndicator color={COLORS.brand} /> : <Text style={{ color: COLORS.brand, fontSize: 24 }}>+</Text>}
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </FF>

          <TouchableOpacity onPress={handleSubmit} disabled={formLoading}
            style={{ backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.xl }}>
            {formLoading ? <ActivityIndicator color={COLORS.elevated} /> : <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: 14, color: COLORS.elevated }}>{editItem ? 'SAVE CHANGES' : 'ADD ITEM'}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheet>

      {/* ── Detail Modal ──────────────────────────────────────────────────────── */}
      <Modal visible={detailItem != null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailItem(null)}>
        {detailItem && (
          <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: COLORS.background }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
              <TouchableOpacity onPress={() => setDetailItem(null)} style={{ paddingRight: SPACING.md }}>
                <Text style={{ color: COLORS.brandDim, fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize }}>‹ Back</Text>
              </TouchableOpacity>
              <Text style={{ fontFamily: TYPOGRAPHY.h3.fontFamily, fontSize: TYPOGRAPHY.h3.fontSize, fontWeight: TYPOGRAPHY.h3.fontWeight, color: COLORS.textPrimary }} numberOfLines={1}>{detailItem.nickname ?? detailItem.sku ?? 'Item'}</Text>
              <TouchableOpacity onPress={() => { setEditItem(detailItem); initForm(detailItem); setDetailItem(null); setSheetVisible(true) }}>
                <Text style={{ color: COLORS.brandDim, fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize }}>Edit</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: SPACING.xl }}>
              {detailItem.photos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.lg }}>
                  <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                    {detailItem.photos.map((uri, i) => <Image key={i} source={{ uri }} style={{ width: 120, height: 120, borderRadius: RADIUS.md }} />)}
                  </View>
                </ScrollView>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md }}>
                <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted }}>{detailItem.sku ?? 'No SKU'}</Text>
                <View style={{ backgroundColor: STATUS_PILL[detailItem.status]?.bg ?? COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 }}>
                  <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color: STATUS_PILL[detailItem.status]?.text ?? COLORS.textMuted }}>{detailItem.status.toUpperCase()}</Text>
                </View>
              </View>
              {detailItem.category  && <DR label="Category"   value={detailItem.category} />}
              {detailItem.condition && <DR label="Condition"  value={detailItem.condition} />}
              <DR label="Platform" value={detailItem.platform} />
              {detailItem.cost      != null && <DR label="Cost"       value={`$${detailItem.cost.toFixed(2)}`} />}
              {detailItem.sellPrice != null && <DR label="Sell Price" value={`$${detailItem.sellPrice.toFixed(2)}`} />}
              {detailItem.cost != null && detailItem.sellPrice != null && data?.settings && (() => {
                const s = data.settings
                const p = calcProfit({ sellPrice: detailItem.sellPrice!, cost: detailItem.cost!, pkgCost: s.pkg_cost, shipCost: s.ship_cost, ebayFee: s.ebay_fee })
                return (
                  <View style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginVertical: SPACING.md, flexDirection: 'row', justifyContent: 'space-between' }}>
                    <DStat label="NET PROFIT" value={<ProfitBadge amount={p.net} size="md" showSign />} />
                    <DStat label="ROI" value={<Text style={{ fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: TYPOGRAPHY.mono.fontSize, fontWeight: '600', color: p.roi > 0 ? COLORS.profitText : COLORS.lossText }}>{p.roi.toFixed(0)}%</Text>} />
                    <DStat label="FEES" value={<Text style={{ fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: TYPOGRAPHY.mono.fontSize, color: COLORS.textSecondary }}>${p.totalFees.toFixed(2)}</Text>} />
                  </View>
                )
              })()}
              {detailItem.notes && <DR label="Notes" value={detailItem.notes} />}
              {detailItem.status !== 'Sold' && (
                <View style={{ marginTop: SPACING.lg }}>
                  <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, marginBottom: SPACING.sm }}>CHANGE STATUS</Text>
                  <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                    {detailItem.status === 'Unlisted' && <SBtn label="MARK LISTED" onPress={() => void handleStatusChange(detailItem, 'Listed')} color={COLORS.brandDim} bg={COLORS.brand + '22'} />}
                    {detailItem.status === 'Listed' && <>
                      <SBtn label="MARK SOLD"   onPress={() => void handleStatusChange(detailItem, 'Sold')}     color={COLORS.brandDim}    bg={COLORS.brand + '22'} />
                      <SBtn label="UNLIST"       onPress={() => void handleStatusChange(detailItem, 'Unlisted')} color={COLORS.warningText} bg={COLORS.warning + '22'} />
                    </>}
                  </View>
                </View>
              )}
              <TouchableOpacity onPress={() => setDeleteTarget(detailItem)}
                style={{ marginTop: SPACING.xl, padding: SPACING.md, alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.loss }}>
                <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.lossText, fontWeight: '600' }}>DELETE ITEM</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal visible={deleteTarget != null} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.inverse + '99', padding: SPACING.xl }}>
          <View style={{ backgroundColor: COLORS.elevated, borderRadius: RADIUS.lg, padding: SPACING.xl, width: '100%' }}>
            <Text style={{ fontFamily: TYPOGRAPHY.h3.fontFamily, fontSize: TYPOGRAPHY.h3.fontSize, fontWeight: TYPOGRAPHY.h3.fontWeight, color: COLORS.textPrimary, marginBottom: SPACING.sm }}>Delete item?</Text>
            <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textSecondary, marginBottom: SPACING.xl }}>
              {'"'}{deleteTarget?.nickname ?? deleteTarget?.sku ?? 'This item'}{'"'} will be permanently removed.
            </Text>
            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
              <TouchableOpacity onPress={() => setDeleteTarget(null)} style={{ flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, alignItems: 'center' }}>
                <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textSecondary }}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void handleConfirmDelete()} style={{ flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.loss, alignItems: 'center' }}>
                <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.elevated }}>DELETE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sold price modal */}
      <Modal visible={soldTarget != null} transparent animationType="slide" onRequestClose={() => setSoldTarget(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.inverse + '60' }}>
          <View style={{ backgroundColor: COLORS.elevated, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: SPACING.xl, paddingBottom: SPACING.xl + SPACING.lg }}>
            <Text style={{ fontFamily: TYPOGRAPHY.h3.fontFamily, fontSize: TYPOGRAPHY.h3.fontSize, fontWeight: TYPOGRAPHY.h3.fontWeight, color: COLORS.textPrimary, marginBottom: 4 }}>Actual sale price?</Text>
            <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, marginBottom: SPACING.lg }} numberOfLines={1}>{soldTarget?.nickname ?? soldTarget?.sku}</Text>
            <TextInput value={soldPrice} onChangeText={setSoldPrice} placeholder="0.00" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" autoFocus style={[inputSty, { fontSize: 24, fontFamily: TYPOGRAPHY.mono.fontFamily, fontWeight: '600' }]} />
            <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md }}>
              <TouchableOpacity onPress={() => setSoldTarget(null)} style={{ flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, alignItems: 'center' }}>
                <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textSecondary }}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void handleConfirmSold()} style={{ flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.brand, alignItems: 'center' }}>
                <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.elevated }}>MARK SOLD</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Picker modal — category & condition */}
      <Modal visible={pickerField != null} transparent animationType="slide" onRequestClose={() => setPickerField(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.inverse + '60' }}>
          <View style={{ backgroundColor: COLORS.elevated, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, maxHeight: '60%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.xl, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
              <Text style={{ fontFamily: TYPOGRAPHY.h3.fontFamily, fontSize: TYPOGRAPHY.h3.fontSize, fontWeight: TYPOGRAPHY.h3.fontWeight, color: COLORS.textPrimary }}>
                {pickerField === 'category' ? 'Category' : 'Condition'}
              </Text>
              <TouchableOpacity onPress={() => setPickerField(null)}>
                <Text style={{ color: COLORS.textMuted, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {(pickerField === 'category' ? CATEGORY_NAMES : CONDITIONS).map(opt => (
                <TouchableOpacity key={opt}
                  onPress={() => {
                    if (pickerField === 'category') setForm(f => ({ ...f, category: opt }))
                    else setForm(f => ({ ...f, condition: opt as ItemCondition }))
                    setPickerField(null)
                  }}
                  style={{ paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textPrimary }}>{opt}</Text>
                  {(pickerField === 'category' ? form.category : form.condition) === opt &&
                    <Text style={{ color: COLORS.brand, fontSize: 16 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  )
}
