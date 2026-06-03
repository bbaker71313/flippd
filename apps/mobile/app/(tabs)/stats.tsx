import React, { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator, Alert, FlatList, Linking, Modal, RefreshControl,
  ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '@sfp/shared'
import type { PnlSummary, PnlExpense, UserTier } from '@sfp/shared'
import { fetchStatsSummary, fetchExpenses, addExpense, createCheckoutSession, type Period } from '../../lib/stats'
import { fetchInventory } from '../../lib/inventory'
import { PaywallModal } from '../../components/ui/PaywallModal'

type ScreenState = 'loading' | 'ready' | 'error'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'month',  label: 'This Month'    },
  { key: 'last30', label: 'Last 30 Days'  },
  { key: 'all',    label: 'All Time'      },
]

const EXPENSE_CATEGORIES: PnlExpense['category'][] = ['supplies', 'mileage', 'storage', 'other']

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
      <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted }}>{label}</Text>
      <Text style={{ fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: TYPOGRAPHY.mono.fontSize, fontWeight: '600', color: color ?? COLORS.textPrimary }}>{value}</Text>
    </View>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color: COLORS.textMuted, marginTop: SPACING.lg, marginBottom: SPACING.sm }}>
      {title.toUpperCase()}
    </Text>
  )
}


export default function StatsScreen() {
  const router = useRouter()
  const [state, setState]         = useState<ScreenState>('loading')
  const [period, setPeriod]       = useState<Period>('month')
  const [tier, setTier]           = useState<string>('trial')
  const [summary, setSummary]     = useState<PnlSummary | null>(null)
  const [expenses, setExpenses]   = useState<PnlExpense[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Paywall
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null)

  // Add expense modal
  const [addVisible, setAddVisible]       = useState(false)
  const [expAmount, setExpAmount]         = useState('')
  const [expCategory, setExpCategory]     = useState<PnlExpense['category']>('supplies')
  const [expDesc, setExpDesc]             = useState('')
  const [expMiles, setExpMiles]           = useState('')
  const [addLoading, setAddLoading]       = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading')
    setError(null)
    try {
      const [inv, sum, exps] = await Promise.all([
        fetchInventory(),
        fetchStatsSummary(period),
        fetchExpenses(),
      ])
      setTier(inv.tier)
      setSummary(sum)
      setExpenses(exps)
      setState('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load stats.')
      setState('error')
    } finally {
      setRefreshing(false)
    }
  }, [period])

  useEffect(() => { void load() }, [load])

  async function handleAddExpense() {
    const amount = parseFloat(expAmount)
    if (isNaN(amount) || amount <= 0) { Alert.alert('Invalid amount', 'Enter a value greater than 0.'); return }
    setAddLoading(true)
    try {
      const miles = expCategory === 'mileage' ? parseFloat(expMiles) || undefined : undefined
      const exp = await addExpense({ amount, category: expCategory, description: expDesc || undefined, miles })
      setExpenses(prev => [exp, ...prev])
      setAddVisible(false)
      setExpAmount(''); setExpDesc(''); setExpMiles('')
      // Refresh summary so P&L reflects new expense
      const sum = await fetchStatsSummary(period)
      setSummary(sum)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save expense.')
    } finally {
      setAddLoading(false)
    }
  }

  async function handleUpgrade() {
    try {
      const url = await createCheckoutSession('hustle')
      await Linking.openURL(url)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not open checkout.')
    }
  }

  const isScout = tier === 'scout'

  if (state === 'loading') return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={COLORS.brand} />
    </SafeAreaView>
  )

  if (state === 'error') return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl }}>
      <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.lossText, textAlign: 'center', marginBottom: SPACING.lg }}>{error}</Text>
      <TouchableOpacity onPress={() => void load()} style={{ backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md }}>
        <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.elevated }}>TRY AGAIN</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )


  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true) }} tintColor={COLORS.brand} />}
      >
        {/* Header */}
        <View style={{ paddingTop: SPACING.lg, paddingBottom: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: TYPOGRAPHY.h2.fontFamily, fontSize: TYPOGRAPHY.h2.fontSize, fontWeight: TYPOGRAPHY.h2.fontWeight, color: COLORS.textPrimary }}>STATS</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/settings')}
            style={{ paddingHorizontal: SPACING.sm, paddingVertical: 4 }}>
            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted }}>⚙ Settings</Text>
          </TouchableOpacity>
        </View>

        {/* ── 1. Period selector ──────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg }}>
          {PERIODS.map(p => (
            <TouchableOpacity key={p.key} onPress={() => setPeriod(p.key)}
              style={{ flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, alignItems: 'center', backgroundColor: period === p.key ? COLORS.brand : COLORS.surface, borderWidth: 1, borderColor: period === p.key ? COLORS.brand : COLORS.border }}>
              <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color: period === p.key ? COLORS.elevated : COLORS.textMuted }}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 2. Profit summary card ──────────────────────────────────────── */}
        {summary && (
          <View style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.xl, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm, marginBottom: SPACING.md }}>
            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, marginBottom: SPACING.sm }}>NET PROFIT</Text>
            <Text style={{ fontFamily: TYPOGRAPHY.display.fontFamily, fontSize: 48, fontWeight: '800', color: summary.netProfit >= 0 ? COLORS.profitText : COLORS.lossText, marginBottom: SPACING.xs }}>
              {summary.netProfit >= 0 ? '+' : ''}${Math.abs(summary.netProfit).toFixed(2)}
            </Text>
            <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, marginBottom: SPACING.lg }}>
              {summary.roi.toFixed(1)}% ROI · {summary.periodLabel}
            </Text>
            <StatRow label="Revenue"    value={`$${summary.totalRevenue.toFixed(2)}`}    color={COLORS.profitText} />
            <StatRow label="COGS"       value={`-$${summary.totalCogs.toFixed(2)}`}      color={COLORS.lossText} />
            <StatRow label="eBay fees"  value={`-$${summary.totalFees.toFixed(2)}`} />
            <StatRow label="Packaging"  value={`-$${summary.totalPackaging.toFixed(2)}`} />
            {summary.totalShipping > 0 && <StatRow label="Shipping" value={`-$${summary.totalShipping.toFixed(2)}`} />}
            {summary.totalExpenses > 0 && <StatRow label="Expenses" value={`-$${summary.totalExpenses.toFixed(2)}`} />}
            {summary.totalMileage > 0  && <StatRow label="Mileage"  value={`-$${summary.totalMileage.toFixed(2)}`} />}
            {summary.taxReserve > 0 && (
              <View style={{ backgroundColor: COLORS.warning + '18', borderRadius: RADIUS.sm, padding: SPACING.sm, marginTop: SPACING.sm }}>
                <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.warningText }}>
                  Tax reserve: ${summary.taxReserve.toFixed(2)} — set aside from net profit
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── 3. Inventory snapshot ───────────────────────────────────────── */}
        {summary && (
          <>
            <SectionHeader title="Inventory" />
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md }}>
              {[
                { label: 'SOLD',     value: summary.itemsSold,     color: COLORS.brandDim },
                { label: 'LISTED',   value: summary.itemsListed,   color: COLORS.brand },
                { label: 'UNLISTED', value: summary.itemsUnlisted, color: COLORS.warningText },
              ].map(({ label, value, color }) => (
                <View key={label} style={{ flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }}>
                  <Text style={{ fontFamily: TYPOGRAPHY.h2.fontFamily, fontSize: TYPOGRAPHY.h2.fontSize, fontWeight: '700', color }}>{value}</Text>
                  <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, marginTop: 2 }}>{label}</Text>
                </View>
              ))}
            </View>
            {summary.avgDaysToSell > 0 && (
              <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, marginBottom: SPACING.sm }}>
                Avg days to sell: {summary.avgDaysToSell.toFixed(0)} days
              </Text>
            )}
          </>
        )}


        {/* ── 4. Expense log ──────────────────────────────────────────────── */}
        <SectionHeader title="Expenses" />
        {isScout ? (
          <TouchableOpacity onPress={() => setPaywallFeature('Expense Tracking')}
            style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.xl, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', marginBottom: SPACING.md }}>
            <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textMuted }}>Expense tracking — Hustle+</Text>
            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.brandDim, marginTop: SPACING.xs }}>SEE PLANS →</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity onPress={() => setAddVisible(true)}
              style={{ backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, alignSelf: 'flex-start', marginBottom: SPACING.sm }}>
              <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.elevated }}>+ ADD EXPENSE</Text>
            </TouchableOpacity>
            {expenses.length === 0 ? (
              <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, marginBottom: SPACING.md }}>No expenses logged yet.</Text>
            ) : (
              <View style={{ gap: SPACING.xs, marginBottom: SPACING.md }}>
                {expenses.slice(0, 10).map(exp => (
                  <View key={exp.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize - 1, color: COLORS.textPrimary }} numberOfLines={1}>
                        {exp.description ?? exp.category}
                      </Text>
                      <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted }}>
                        {exp.expenseDate} · {exp.category}{exp.miles ? ` · ${exp.miles} mi` : ''}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: TYPOGRAPHY.mono.fontSize, fontWeight: '600', color: COLORS.lossText, marginLeft: SPACING.sm }}>
                      -${exp.amount.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── 5. Mileage tracker ──────────────────────────────────────────── */}
        <SectionHeader title="Mileage" />
        {isScout ? (
          <TouchableOpacity onPress={() => setPaywallFeature('Mileage Tracker')}
            style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.xl, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', marginBottom: SPACING.md }}>
            <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textMuted }}>Mileage deduction tracking — Hustle+</Text>
            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.brandDim, marginTop: SPACING.xs }}>SEE PLANS →</Text>
          </TouchableOpacity>
        ) : (
          <>
            {summary && summary.totalMileage > 0 ? (
              <View style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm }}>
                <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textSecondary }}>
                  ${summary.totalMileage.toFixed(2)} total deduction this period
                </Text>
              </View>
            ) : (
              <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, marginBottom: SPACING.sm }}>
                No mileage logged. Add a mileage expense to track sourcing trips.
              </Text>
            )}
            <TouchableOpacity onPress={() => { setExpCategory('mileage'); setAddVisible(true) }}
              style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md }}>
              <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textSecondary }}>+ LOG TRIP</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* ── Paywall modal ────────────────────────────────────────────────── */}
      <PaywallModal
        visible={paywallFeature != null}
        onClose={() => setPaywallFeature(null)}
        featureName={paywallFeature ?? ''}
        requiredTier="hustle"
        onUpgrade={handleUpgrade}
      />

      {/* ── Add expense modal ────────────────────────────────────────────── */}
      <Modal visible={addVisible} transparent animationType="slide" onRequestClose={() => setAddVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.inverse + '60' }}>
          <View style={{ backgroundColor: COLORS.elevated, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: SPACING.xl, paddingBottom: SPACING.xl + SPACING.lg }}>
            <Text style={{ fontFamily: TYPOGRAPHY.h3.fontFamily, fontSize: TYPOGRAPHY.h3.fontSize, fontWeight: TYPOGRAPHY.h3.fontWeight, color: COLORS.textPrimary, marginBottom: SPACING.lg }}>
              {expCategory === 'mileage' ? 'LOG TRIP' : 'ADD EXPENSE'}
            </Text>

            {/* Category pills */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.md }}>
              {EXPENSE_CATEGORIES.map(cat => (
                <TouchableOpacity key={cat} onPress={() => setExpCategory(cat)}
                  style={{ paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: expCategory === cat ? COLORS.brand : COLORS.surface, borderWidth: 1, borderColor: expCategory === cat ? COLORS.brand : COLORS.border }}>
                  <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: expCategory === cat ? COLORS.elevated : COLORS.textMuted }}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {expCategory === 'mileage' ? (
              <>
                <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, marginBottom: 6 }}>MILES DRIVEN</Text>
                <TextInput value={expMiles} onChangeText={setExpMiles} placeholder="0" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" autoFocus
                  style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: 24, color: COLORS.textPrimary, marginBottom: SPACING.md }} />
              </>
            ) : (
              <>
                <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, marginBottom: 6 }}>AMOUNT</Text>
                <TextInput value={expAmount} onChangeText={setExpAmount} placeholder="0.00" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" autoFocus
                  style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: 24, color: COLORS.textPrimary, marginBottom: SPACING.md }} />
                <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, marginBottom: 6 }}>DESCRIPTION (optional)</Text>
                <TextInput value={expDesc} onChangeText={setExpDesc} placeholder="e.g. Bubble wrap, tape" placeholderTextColor={COLORS.textMuted}
                  style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textPrimary, marginBottom: SPACING.md }} />
              </>
            )}

            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
              <TouchableOpacity onPress={() => { setAddVisible(false); setExpCategory('supplies') }} style={{ flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, alignItems: 'center' }}>
                <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textSecondary }}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void handleAddExpense()} disabled={addLoading}
                style={{ flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.brand, alignItems: 'center' }}>
                {addLoading ? <ActivityIndicator color={COLORS.elevated} /> :
                  <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.elevated }}>SAVE</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
