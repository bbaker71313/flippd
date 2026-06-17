import React, { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView,
  Text, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { usePostHog } from 'posthog-react-native'
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '@sfp/shared'
import type { GrowthReport } from '@sfp/shared'
import { fetchGrowthReport, type GrowthReportResult } from '../../lib/growth'
import { fetchInventory } from '../../lib/inventory'

interface SeasonalTip {
  category: string
  reason: string
  priority: 'HIGH' | 'MED'
  monthsAhead: number
}

// Static seed data keyed by month index (0=Jan). Rotate based on current month.
const SEASONAL_BY_MONTH: Record<number, SeasonalTip[]> = {
  0: [ // Jan
    { category: 'Winter Coats', reason: 'Post-holiday clearance — buy low, sell next Oct', priority: 'HIGH', monthsAhead: 9 },
    { category: 'Electronics', reason: 'Gift returns hit thrift stores in January', priority: 'HIGH', monthsAhead: 0 },
    { category: 'Exercise Equipment', reason: 'New Year demand through February', priority: 'MED', monthsAhead: 0 },
    { category: 'Holiday Décor', reason: 'Buy at clearance for next December', priority: 'MED', monthsAhead: 11 },
  ],
  1: [ // Feb
    { category: 'Valentine Gifts', reason: 'Jewelry and small gifts moving fast', priority: 'HIGH', monthsAhead: 0 },
    { category: 'Winter Outerwear', reason: 'Clearance pricing — source for next season', priority: 'MED', monthsAhead: 8 },
    { category: 'Board Games', reason: 'Cold-weather demand still strong', priority: 'MED', monthsAhead: 0 },
    { category: 'Fitness Gear', reason: 'New Year resolution buyers still active', priority: 'MED', monthsAhead: 0 },
  ],
  2: [ // Mar
    { category: 'Spring Clothing', reason: 'Demand picks up as weather warms', priority: 'HIGH', monthsAhead: 0 },
    { category: 'Gardening Tools', reason: 'Source now before spring rush', priority: 'HIGH', monthsAhead: 1 },
    { category: 'Kids Toys', reason: 'Spring break buying season starts', priority: 'MED', monthsAhead: 0 },
    { category: 'Vintage Electronics', reason: 'Year-round strong category', priority: 'MED', monthsAhead: 0 },
  ],
  3: [ // Apr
    { category: 'Outdoor Furniture', reason: 'Buyers prepping for summer — source early', priority: 'HIGH', monthsAhead: 1 },
    { category: 'Spring/Summer Clothing', reason: 'Peak sourcing window open now', priority: 'HIGH', monthsAhead: 0 },
    { category: 'Sports Equipment', reason: 'Youth sports season driving demand', priority: 'MED', monthsAhead: 0 },
    { category: 'Power Tools', reason: 'Home improvement season beginning', priority: 'MED', monthsAhead: 0 },
  ],
  4: [ // May
    { category: 'Camping Gear', reason: 'Memorial Day weekend kicks off camping season', priority: 'HIGH', monthsAhead: 0 },
    { category: 'Graduation Gifts', reason: 'Electronics, bags, and accessories moving', priority: 'HIGH', monthsAhead: 0 },
    { category: 'Back-to-School Prep', reason: 'Source now — demand peaks in August', priority: 'MED', monthsAhead: 3 },
    { category: 'Summer Clothing', reason: 'Peak demand window open', priority: 'MED', monthsAhead: 0 },
  ],
  5: [ // Jun
    { category: 'Back-to-School Supplies', reason: 'Source now — demand peaks in August', priority: 'HIGH', monthsAhead: 2 },
    { category: 'Electronics & Gaming', reason: 'Summer demand and gift-giving strong', priority: 'HIGH', monthsAhead: 0 },
    { category: 'Outdoor & Camping', reason: 'Peak summer sourcing window', priority: 'MED', monthsAhead: 0 },
    { category: 'Sports Equipment', reason: 'Summer leagues driving equipment demand', priority: 'MED', monthsAhead: 0 },
    { category: 'Vintage Clothing', reason: 'Summer fashion buying at its peak', priority: 'MED', monthsAhead: 0 },
  ],
  6: [ // Jul
    { category: 'Back-to-School', reason: 'August rush approaching — source now', priority: 'HIGH', monthsAhead: 1 },
    { category: 'Fall Clothing', reason: 'Source at summer clearance for Sept', priority: 'HIGH', monthsAhead: 2 },
    { category: 'Dorm/College Items', reason: 'College move-in demand peaks in August', priority: 'MED', monthsAhead: 1 },
    { category: 'Sports Cards & Collectibles', reason: 'Summer collector activity strong', priority: 'MED', monthsAhead: 0 },
  ],
  7: [ // Aug
    { category: 'Fall / Winter Coats', reason: 'Source at end-of-summer clearance for Oct–Nov', priority: 'HIGH', monthsAhead: 2 },
    { category: 'Halloween Costumes', reason: 'Source now — demand spikes in October', priority: 'HIGH', monthsAhead: 2 },
    { category: 'School Electronics', reason: 'Back-to-school buyers active all month', priority: 'MED', monthsAhead: 0 },
    { category: 'Board Games & Toys', reason: 'Holiday sourcing begins for serious sellers', priority: 'MED', monthsAhead: 3 },
  ],
  8: [ // Sep
    { category: 'Halloween Items', reason: 'October demand window opens soon', priority: 'HIGH', monthsAhead: 1 },
    { category: 'Fall Décor', reason: 'Buyers prepping homes for the season', priority: 'HIGH', monthsAhead: 0 },
    { category: 'Holiday Toys', reason: 'Source now before Black Friday scarcity', priority: 'MED', monthsAhead: 2 },
    { category: 'Cold-Weather Gear', reason: 'Jackets, boots, flannels trending up', priority: 'MED', monthsAhead: 0 },
  ],
  9: [ // Oct
    { category: 'Holiday Gifts (Electronics)', reason: 'Source now — November demand surges', priority: 'HIGH', monthsAhead: 1 },
    { category: 'Toys & Games', reason: 'Christmas buying window opening', priority: 'HIGH', monthsAhead: 1 },
    { category: 'Winter Outerwear', reason: 'Peak demand for coats starting', priority: 'MED', monthsAhead: 0 },
    { category: 'Vintage / Collectibles', reason: 'Gift buyers active through December', priority: 'MED', monthsAhead: 0 },
  ],
  10: [ // Nov
    { category: 'Post-Black Friday Electronics', reason: 'Returns and deals appear at thrift stores in Dec', priority: 'HIGH', monthsAhead: 1 },
    { category: 'Holiday Décor', reason: 'Last buying window before Christmas', priority: 'MED', monthsAhead: 0 },
    { category: 'Winter Clothing', reason: 'Cold weather buying at peak', priority: 'MED', monthsAhead: 0 },
    { category: 'Toys & Kids Gifts', reason: 'December demand window still open', priority: 'HIGH', monthsAhead: 0 },
  ],
  11: [ // Dec
    { category: 'Post-Christmas Electronics', reason: 'Gift returns hit stores in January — position now', priority: 'HIGH', monthsAhead: 1 },
    { category: 'Winter Coats', reason: 'Source at clearance for next winter', priority: 'MED', monthsAhead: 9 },
    { category: 'New Year Fitness', reason: 'January demand surge for exercise gear', priority: 'HIGH', monthsAhead: 1 },
    { category: 'Holiday Décor', reason: 'Deep clearance now — sell next December', priority: 'MED', monthsAhead: 12 },
  ],
}

function getSeasonalTips(): SeasonalTip[] {
  const month = new Date().getMonth()
  return SEASONAL_BY_MONTH[month] ?? SEASONAL_BY_MONTH[5]
}

type ScreenState = 'loading' | 'empty' | 'generating' | 'ready' | 'error'

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  relist:     { bg: COLORS.profit + '22', text: COLORS.profitText },
  drop_price: { bg: COLORS.accent + '22', text: COLORS.accent },
  bundle:     { bg: COLORS.brand + '22', text: COLORS.brandDim },
  donate:     { bg: COLORS.border, text: COLORS.textMuted },
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <View style={{ height: 8, backgroundColor: COLORS.border, borderRadius: RADIUS.full, overflow: 'hidden', marginVertical: SPACING.sm }}>
      <View style={{ height: 8, width: `${Math.min(100, score)}%` as unknown as number, backgroundColor: color, borderRadius: RADIUS.full }} />
    </View>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color: COLORS.textMuted, marginBottom: SPACING.sm, marginTop: SPACING.lg }}>
      {title.toUpperCase()}
    </Text>
  )
}

function GateOverlay({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <View style={{ backgroundColor: COLORS.surface + 'ee', borderRadius: RADIUS.md, padding: SPACING.xl, alignItems: 'center', marginTop: SPACING.sm, borderWidth: 1, borderColor: COLORS.border }}>
      <Text style={{ fontFamily: TYPOGRAPHY.h3.fontFamily, fontSize: TYPOGRAPHY.h3.fontSize, fontWeight: TYPOGRAPHY.h3.fontWeight, color: COLORS.textPrimary, textAlign: 'center', marginBottom: SPACING.sm }}>
        Upgrade to Hustle to unlock your full weekly brief
      </Text>
      <TouchableOpacity onPress={onUpgrade} style={{ backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, marginTop: SPACING.sm }}>
        <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color: COLORS.elevated }}>SEE PLANS</Text>
      </TouchableOpacity>
    </View>
  )
}


export default function TrendsScreen() {
  const [state, setState]           = useState<ScreenState>('loading')
  const [result, setResult]         = useState<GrowthReportResult | null>(null)
  const [tier, setTier]             = useState<string>('trial')
  const [error, setError]           = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast]           = useState<string | null>(null)
  const [dismissedSkus, setDismissedSkus] = useState<string[]>([])

  const router  = useRouter()
  const posthog = usePostHog()

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  const load = useCallback(async (force = false) => {
    setError(null)

    try {
      // Check inventory count first — empty state if < 5 items
      const inv = await fetchInventory()
      setTier(inv.tier)
      if (inv.itemCount < 5) {
        setState('empty')
        return
      }

      if (!force && result?.cached === true) {
        // Already have fresh cache in memory
        setState('ready')
        return
      }

      // If forcing refresh and cache is fresh → toast and bail
      if (force && result?.generatedAt) {
        const ageHours = (Date.now() - new Date(result.generatedAt).getTime()) / 3600000
        if (ageHours < 24) {
          showToast('Brief is current — check back tomorrow')
          setRefreshing(false)
          return
        }
      }

      setState(result == null ? 'generating' : 'loading')
      const data = await fetchGrowthReport(force)
      setResult(data)

      if (force && data.cached) {
        showToast('Brief is current — check back tomorrow')
      }

      setState('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your brief.')
      setState('error')
    } finally {
      setRefreshing(false)
    }
  }, [result, showToast])

  useEffect(() => { void load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const report  = result?.data as GrowthReport | undefined
  const isScout = tier === 'scout'
  const dateStr = result?.generatedAt
    ? new Date(result.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  // ── Loading / Generating ──────────────────────────────────────────────────
  if (state === 'loading' || state === 'generating') {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.brand} size="large" />
        <Text style={{ fontFamily: TYPOGRAPHY.h3.fontFamily, fontSize: TYPOGRAPHY.h3.fontSize, fontWeight: TYPOGRAPHY.h3.fontWeight, color: COLORS.textPrimary, marginTop: SPACING.lg }}>
          {state === 'generating' ? 'Your AI advisor is analyzing...' : 'Loading...'}
        </Text>
        {state === 'generating' && (
          <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, marginTop: SPACING.sm, textAlign: 'center', paddingHorizontal: SPACING.xl }}>
            Pulling your inventory data and current market trends
          </Text>
        )}
      </SafeAreaView>
    )
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (state === 'empty') {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl }}>
        {/* was: 🔭 now: text label */}
        <Text style={{ fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: TYPOGRAPHY.mono.fontSize, color: COLORS.textMuted, letterSpacing: 4, marginBottom: SPACING.lg }}>
          [ NO DATA ]
        </Text>
        <Text style={{ fontFamily: TYPOGRAPHY.h2.fontFamily, fontSize: TYPOGRAPHY.h2.fontSize, fontWeight: TYPOGRAPHY.h2.fontWeight, color: COLORS.textPrimary, textAlign: 'center', marginBottom: SPACING.sm }}>
          Scout some items first
        </Text>
        <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textMuted, textAlign: 'center' }}>
          Add 5 or more items to get your personalized weekly brief.
        </Text>
      </SafeAreaView>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl }}>
        <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.lossText, textAlign: 'center', marginBottom: SPACING.lg }}>{error}</Text>
        <TouchableOpacity onPress={() => void load()} style={{ backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md }}>
          <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.elevated }}>TRY AGAIN</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }


  // ── Ready ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background }}>

      {/* Toast */}
      {toast && (
        <View style={{ position: 'absolute', top: 60, left: SPACING.xl, right: SPACING.xl, zIndex: 99, backgroundColor: COLORS.inverse, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', ...SHADOWS.md }}>
          <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textInverse }}>{toast}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true) }} tintColor={COLORS.brand} />}
      >
        {/* Header */}
        <View style={{ paddingTop: SPACING.lg, paddingBottom: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: TYPOGRAPHY.h2.fontFamily, fontSize: TYPOGRAPHY.h2.fontSize, fontWeight: TYPOGRAPHY.h2.fontWeight, color: COLORS.textPrimary }}>THIS WEEK'S BRIEF</Text>
          {result?.cached && (
            <View style={{ backgroundColor: COLORS.brand + '22', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 }}>
              <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.brandDim }}>CACHED</Text>
            </View>
          )}
        </View>

        {/* ── 1. Business Score card ───────────────────────────────────────── */}
        {report && (
          <View style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.xl, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', ...SHADOWS.sm }}>
            <Text style={{ fontFamily: TYPOGRAPHY.display.fontFamily, fontSize: 64, fontWeight: '800', color: report.score_color || COLORS.brand }}>
              {report.business_score}
            </Text>
            <Text style={{ fontFamily: TYPOGRAPHY.h3.fontFamily, fontSize: TYPOGRAPHY.h3.fontSize, fontWeight: TYPOGRAPHY.h3.fontWeight, color: COLORS.textPrimary, marginBottom: SPACING.sm }}>
              {report.score_label}
            </Text>
            <View style={{ width: '100%' }}>
              <ScoreBar score={report.business_score} color={report.score_color || COLORS.brand} />
            </View>
            <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize - 1, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.sm }}>
              {report.score_summary}
            </Text>
          </View>
        )}

        {/* ── 2. Top categories (gated for Scout) ─────────────────────────── */}
        {report && report.top_categories.length > 0 && (
          <>
            <SectionHeader title="Your opportunities this week" />
            {isScout ? (
              <GateOverlay onUpgrade={() => {}} />
            ) : (
              <View style={{ gap: SPACING.sm }}>
                {report.top_categories.slice(0, 2).map((cat, i) => (
                  <View key={i} style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs }}>
                      <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: '600', color: COLORS.textPrimary }}>{cat.name}</Text>
                      <Text style={{ fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: TYPOGRAPHY.mono.fontSize, fontWeight: '600', color: cat.profit >= 0 ? COLORS.profitText : COLORS.lossText }}>
                        {cat.profit >= 0 ? '+' : ''}${Math.abs(cat.profit).toFixed(0)} profit
                      </Text>
                    </View>
                    <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, marginBottom: SPACING.xs }}>
                      {cat.sold_count} sold
                    </Text>
                    <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize - 1, color: COLORS.textSecondary }}>{cat.insight}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}


        {/* ── 3. Action Queue (gated for Scout) ───────────────────────────── */}
        {/* Change 14: was "Items that need attention" */}
        {report && report.stale_actions.length > 0 && (
          <>
            <SectionHeader title="Action Queue" />
            {isScout ? (
              <GateOverlay onUpgrade={() => {}} />
            ) : (
              <View style={{ gap: SPACING.sm }}>
                {report.stale_actions
                  .filter(item => !dismissedSkus.includes(item.sku))
                  .map((item, i) => {
                    const ac = ACTION_COLORS[item.action] ?? ACTION_COLORS.relist
                    return (
                      <Pressable
                        key={item.sku + i}
                        onPress={() => {
                          posthog?.capture('action_queue_item_tapped', { action_type: item.action })
                          router.push({ pathname: '/(tabs)/inventory', params: { editSku: item.sku } } as never)
                        }}
                        style={({ pressed }: { pressed: boolean }) => ({
                          backgroundColor: pressed ? COLORS.surface + 'cc' : COLORS.surface,
                          borderRadius: RADIUS.md,
                          padding: SPACING.md,
                          borderWidth: 1,
                          borderColor: COLORS.border,
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                        })}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: '600', color: COLORS.textPrimary }} numberOfLines={1}>{item.nickname}</Text>
                          <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted }}>{item.days_listed} days unlisted</Text>
                          <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize - 1, color: COLORS.textSecondary, marginTop: 4 }}>{item.suggestion}</Text>
                        </View>
                        <View style={{ backgroundColor: ac.bg, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3, marginLeft: SPACING.sm, flexShrink: 0 }}>
                          <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color: ac.text }}>
                            {item.action.replace('_', ' ').toUpperCase()}
                          </Text>
                        </View>
                        {/* Dismiss button */}
                        <Pressable
                          hitSlop={8}
                          onPress={() => {
                            posthog?.capture('action_queue_item_dismissed', { action_type: item.action })
                            setDismissedSkus((prev: string[]) => [...prev, item.sku])
                          }}
                          style={{ paddingLeft: SPACING.sm, paddingTop: 2 }}
                        >
                          <Text style={{ fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: 16, color: COLORS.textMuted }}>×</Text>
                        </Pressable>
                      </Pressable>
                    )
                  })}
              </View>
            )}
          </>
        )}

        {/* ── 4. Hunt list — visible to Scout ─────────────────────────────── */}
        {report && report.hunt_list.length > 0 && (
          <>
            <SectionHeader title="What to hunt for" />
            <View style={{ gap: SPACING.sm }}>
              {report.hunt_list.slice(0, 3).map((h, i) => (
                <View key={i} style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center' }}>
                  {h.icon ? (
                    <Text style={{ fontSize: 22, marginRight: SPACING.md }}>{h.icon}</Text>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: '600', color: COLORS.textPrimary }}>{h.item}</Text>
                    <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize - 1, color: COLORS.textSecondary, marginTop: 2 }}>{h.reason}</Text>
                  </View>
                  <View style={{ backgroundColor: h.priority === 'HIGH' ? COLORS.brand + '22' : COLORS.warning + '22', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3, marginLeft: SPACING.sm }}>
                    <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color: h.priority === 'HIGH' ? COLORS.brandDim : COLORS.warningText }}>
                      {h.priority}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}


        {/* ── 5. Market trends (gated for Scout) ──────────────────────────── */}
        {report && report.market_trends.length > 0 && (
          <>
            <SectionHeader title="What's moving right now" />
            {isScout ? (
              <GateOverlay onUpgrade={() => {}} />
            ) : (
              <View style={{ gap: SPACING.sm }}>
                {report.market_trends.slice(0, 4).map((t, i) => (
                  <View key={i} style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, marginRight: SPACING.md, color: t.direction === 'up' ? COLORS.profitText : COLORS.lossText }}>
                      {t.direction === 'up' ? '↑' : '↓'}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: '600', color: COLORS.textPrimary }}>{t.category}</Text>
                      <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize - 1, color: COLORS.textSecondary, marginTop: 2 }}>{t.reasoning}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── 6. Advisor message (gated for Scout) ────────────────────────── */}
        {report && report.advisor_message && (
          <>
            <SectionHeader title="From your advisor" />
            {isScout ? (
              <GateOverlay onUpgrade={() => {}} />
            ) : (
              <View style={{ backgroundColor: COLORS.elevated, borderRadius: RADIUS.md, padding: SPACING.xl, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4, borderLeftColor: COLORS.brand }}>
                <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textPrimary, lineHeight: 26 }}>
                  {report.advisor_message}
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── 7. Upcoming Seasonal Sourcing (Change 17) ───────────────────── */}
        {(() => {
          const tips = getSeasonalTips()
          return (
            <>
              <SectionHeader title="Source now" />
              <View style={{ gap: SPACING.sm }}>
                {tips.map((tip, i) => (
                  <View key={i} style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: '600', color: COLORS.textPrimary }}>{tip.category}</Text>
                      <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize - 1, color: COLORS.textSecondary, marginTop: 2 }}>{tip.reason}</Text>
                      {tip.monthsAhead > 0 && (
                        <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, marginTop: 2 }}>
                          {tip.monthsAhead === 1 ? '1 month ahead' : `${tip.monthsAhead} months ahead`}
                        </Text>
                      )}
                    </View>
                    <View style={{ backgroundColor: tip.priority === 'HIGH' ? COLORS.brand + '22' : COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3, marginLeft: SPACING.sm }}>
                      <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color: tip.priority === 'HIGH' ? COLORS.brandDim : COLORS.textMuted }}>
                        {tip.priority}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )
        })()}

        {/* ── 8. Footer ────────────────────────────────────────────────────── */}
        <View style={{ marginTop: SPACING.xl, alignItems: 'center', gap: SPACING.sm }}>
          {dateStr && (
            <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted }}>
              Updated {dateStr} · Refreshes every 24 hours
            </Text>
          )}
          <TouchableOpacity
            onPress={() => { setRefreshing(true); void load(true) }}
            style={{ paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border }}>
            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textSecondary }}>REFRESH</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}
