import React, { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator, Alert, FlatList, ScrollView,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS, TIER_LIMITS } from '@sfp/shared'
import type { InventoryItem, ListingDraft, TrendingKeyword, UserTier } from '@sfp/shared'
import { generateListing, fetchKeywords, markAsListed, exportCsv } from '../../lib/listing'
import { fetchInventory } from '../../lib/inventory'

type Screen = 'picker' | 'generating' | 'draft'

const inputSty = {
  backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
  borderWidth: 1, borderColor: COLORS.border,
  paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize,
  color: COLORS.textPrimary,
} as const

function FieldRow({ label, onCopy }: { label: string; onCopy: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted }}>{label}</Text>
      <TouchableOpacity onPress={onCopy} style={{ paddingHorizontal: SPACING.sm, paddingVertical: 3, backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border }}>
        <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.brandDim }}>COPY TO CLIPBOARD</Text>
      </TouchableOpacity>
    </View>
  )
}


export default function ListingScreen() {
  const [screen, setScreen]           = useState<Screen>('picker')
  const [items, setItems]             = useState<InventoryItem[]>([])
  const [tier, setTier]               = useState<string>('trial')
  const [loadingItems, setLoadingItems] = useState(true)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [draft, setDraft]             = useState<ListingDraft | null>(null)
  const [keywords, setKeywords]       = useState<TrendingKeyword[]>([])
  const [hotTip, setHotTip]           = useState<string | null>(null)
  const [exporting, setExporting]     = useState(false)
  const [markingListed, setMarkingListed] = useState(false)
  const [error, setError]             = useState<string | null>(null)

  // Editable draft fields
  const [editTitle, setEditTitle]       = useState('')
  const [editDesc, setEditDesc]         = useState('')
  const [editCondNote, setEditCondNote] = useState('')
  const [editPrice, setEditPrice]       = useState('')

  const loadItems = useCallback(async () => {
    setLoadingItems(true)
    try {
      const result = await fetchInventory()
      // Only Unlisted + Listed — not Sold
      setItems(result.items.filter(i => i.status === 'Unlisted' || i.status === 'Listed'))
      setTier(result.tier)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory')
    } finally {
      setLoadingItems(false)
    }
  }, [])

  useEffect(() => { void loadItems() }, [loadItems])

  async function handleGenerate(item: InventoryItem) {
    setSelectedItem(item)
    setScreen('generating')
    setError(null)
    try {
      const [generated, kw] = await Promise.all([
        generateListing(item),
        fetchKeywords(),
      ])
      setDraft(generated)
      setEditTitle(generated.title)
      setEditDesc(generated.description)
      setEditCondNote(generated.conditionNote)
      setEditPrice(generated.suggestedPrice != null ? String(generated.suggestedPrice) : '')
      setKeywords(kw.keywords ?? [])
      setHotTip(kw.hot_tip ?? null)
      setScreen('draft')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed. Try again.')
      setScreen('picker')
    }
  }

  async function handleExportCsv() {
    if (!selectedItem || !draft) return
    const userTier = tier as UserTier
    const canExport = userTier !== 'scout'
    if (!canExport) {
      Alert.alert('Hustle plan required', 'CSV export is available on Hustle and above.',
        [{ text: 'Not Now', style: 'cancel' }, { text: 'Upgrade', onPress: () => {} }])
      return
    }
    setExporting(true)
    try {
      const currentDraft: ListingDraft = {
        ...draft, title: editTitle.slice(0, 80), description: editDesc,
        conditionNote: editCondNote,
        suggestedPrice: parseFloat(editPrice) || draft.suggestedPrice,
      }
      await exportCsv(selectedItem, currentDraft)
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Could not export CSV.')
    } finally {
      setExporting(false)
    }
  }

  async function handleMarkListed() {
    if (!selectedItem) return
    setMarkingListed(true)
    try {
      await markAsListed(selectedItem.id)
      setItems(prev => prev.filter(i => i.id !== selectedItem.id))
      Alert.alert('Marked as Listed', `${selectedItem.nickname ?? 'Item'} is now Listed.`,
        [{ text: 'OK', onPress: () => { setScreen('picker'); setDraft(null); setSelectedItem(null) } }])
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update status.')
    } finally {
      setMarkingListed(false)
    }
  }


  // ── Picker screen ──────────────────────────────────────────────────────────
  if (screen === 'picker') {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={{ paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md }}>
          <Text style={{ fontFamily: TYPOGRAPHY.h2.fontFamily, fontSize: TYPOGRAPHY.h2.fontSize, fontWeight: TYPOGRAPHY.h2.fontWeight, color: COLORS.textPrimary }}>LISTING</Text>
          <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, marginTop: 4 }}>Pick an item to write a listing</Text>
        </View>

        {error && (
          <View style={{ marginHorizontal: SPACING.xl, marginBottom: SPACING.md, backgroundColor: `${COLORS.loss}18`, borderRadius: RADIUS.md, padding: SPACING.md }}>
            <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.lossText }}>{error}</Text>
          </View>
        )}

        {loadingItems ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={COLORS.brand} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={i => String(i.id)}
            contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingBottom: 40, gap: SPACING.sm }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <Text style={{ fontFamily: TYPOGRAPHY.h3.fontFamily, fontSize: TYPOGRAPHY.h3.fontSize, color: COLORS.textMuted, marginBottom: SPACING.sm }}>No items</Text>
                <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, textAlign: 'center' }}>
                  Add items to inventory first, then come back to write listings.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => void handleGenerate(item)}
                style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...SHADOWS.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: '600', color: COLORS.textPrimary }} numberOfLines={1}>
                    {item.nickname ?? item.sku ?? 'Unnamed item'}
                  </Text>
                  <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, marginTop: 2 }}>
                    {[item.category, item.condition].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View style={{ backgroundColor: item.status === 'Listed' ? COLORS.brand + '22' : COLORS.warning + '22', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3, marginLeft: SPACING.md }}>
                  <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color: item.status === 'Listed' ? COLORS.brandDim : COLORS.warningText }}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    )
  }


  // ── Generating screen ─────────────────────────────────────────────────────
  if (screen === 'generating') {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.brand} size="large" />
        <Text style={{ fontFamily: TYPOGRAPHY.h3.fontFamily, fontSize: TYPOGRAPHY.h3.fontSize, fontWeight: TYPOGRAPHY.h3.fontWeight, color: COLORS.textPrimary, marginTop: SPACING.lg }}>Writing your listing...</Text>
        <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, marginTop: SPACING.sm, textAlign: 'center', paddingHorizontal: SPACING.xl }}>
          {selectedItem?.nickname ?? 'Item'} · Pulling keywords + pricing data
        </Text>
      </SafeAreaView>
    )
  }

  // ── Draft screen ──────────────────────────────────────────────────────────
  if (screen === 'draft' && draft) {
    const titleLen = editTitle.length
    const titleOver = titleLen > 80

    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md }}>
          <TouchableOpacity onPress={() => setScreen('picker')} style={{ marginRight: SPACING.md }}>
            <Text style={{ color: COLORS.brandDim, fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize }}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: TYPOGRAPHY.h3.fontFamily, fontSize: TYPOGRAPHY.h3.fontSize, fontWeight: TYPOGRAPHY.h3.fontWeight, color: COLORS.textPrimary, flex: 1 }} numberOfLines={1}>
            {selectedItem?.nickname ?? 'Listing'}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

          {/* Title */}
          <View style={{ marginBottom: SPACING.md }}>
            <FieldRow label={`TITLE  ${titleLen}/80`} onCopy={() => void Clipboard.setStringAsync(editTitle)} />
            <TextInput
              value={editTitle}
              onChangeText={v => setEditTitle(v.slice(0, 80))}
              style={[inputSty, titleOver && { borderColor: COLORS.loss }]}
              maxLength={80}
            />
            {titleOver && <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.lossText, marginTop: 3 }}>Title exceeds 80 chars — eBay will reject it</Text>}
          </View>

          {/* Description */}
          <View style={{ marginBottom: SPACING.md }}>
            <FieldRow label="DESCRIPTION" onCopy={() => void Clipboard.setStringAsync(editDesc)} />
            <TextInput
              value={editDesc}
              onChangeText={setEditDesc}
              multiline
              style={[inputSty, { height: 160, textAlignVertical: 'top' }]}
            />
          </View>

          {/* Condition note */}
          <View style={{ marginBottom: SPACING.md }}>
            <FieldRow label="CONDITION NOTE" onCopy={() => void Clipboard.setStringAsync(editCondNote)} />
            <TextInput
              value={editCondNote}
              onChangeText={setEditCondNote}
              multiline
              style={[inputSty, { height: 80, textAlignVertical: 'top' }]}
            />
          </View>

          {/* Price */}
          <View style={{ marginBottom: SPACING.md }}>
            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, marginBottom: 6 }}>{"WHAT'S IT WORTH?"}</Text>
            <TextInput
              value={editPrice}
              onChangeText={setEditPrice}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
              style={inputSty}
            />
          </View>


          {/* Keywords from listing */}
          {draft.keywords.length > 0 && (
            <View style={{ marginBottom: SPACING.lg }}>
              <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, marginBottom: SPACING.sm }}>LISTING KEYWORDS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs }}>
                {draft.keywords.map((kw, i) => (
                  <TouchableOpacity key={i} onPress={() => void Clipboard.setStringAsync(kw)}
                    style={{ backgroundColor: COLORS.brand + '18', borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.brand + '44' }}>
                    <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.brandDim }}>{kw}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Trending keywords */}
          {keywords.length > 0 && (
            <View style={{ marginBottom: SPACING.lg, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, marginBottom: SPACING.sm }}>TRENDING ON EBAY NOW</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.sm }}>
                {keywords.slice(0, 6).map((kw, i) => (
                  <TouchableOpacity key={i} onPress={() => void Clipboard.setStringAsync(kw.word)}
                    style={{ backgroundColor: kw.trend === 'up' ? COLORS.brand + '18' : COLORS.surface, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderWidth: 1, borderColor: kw.trend === 'up' ? COLORS.brand + '55' : COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: kw.trend === 'up' ? COLORS.brandDim : COLORS.textSecondary }}>{kw.trend === 'up' ? '↑ ' : ''}{kw.word}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {hotTip && <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, fontStyle: 'italic' }}>{hotTip}</Text>}
            </View>
          )}

          {/* Shipping note */}
          {draft.shippingNote && (
            <View style={{ marginBottom: SPACING.lg }}>
              <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, marginBottom: 4 }}>SHIPPING</Text>
              <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize - 1, color: COLORS.textSecondary }}>{draft.shippingNote}</Text>
            </View>
          )}

          {/* Actions */}
          <TouchableOpacity
            onPress={() => void handleExportCsv()}
            disabled={exporting}
            style={{ backgroundColor: COLORS.inverse, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', marginBottom: SPACING.md, ...SHADOWS.sm }}>
            {exporting
              ? <ActivityIndicator color={COLORS.textInverse} />
              : <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color: COLORS.textInverse }}>EXPORT TO EBAY CSV</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => void handleMarkListed()}
            disabled={markingListed || selectedItem?.status === 'Listed'}
            style={{ backgroundColor: selectedItem?.status === 'Listed' ? COLORS.border : COLORS.brand, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', marginBottom: SPACING.xl }}>
            {markingListed
              ? <ActivityIndicator color={COLORS.elevated} />
              : <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color: selectedItem?.status === 'Listed' ? COLORS.textMuted : COLORS.elevated }}>
                  {selectedItem?.status === 'Listed' ? 'ALREADY LISTED' : 'MARK AS LISTED'}
                </Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    )
  }

  return null
}
