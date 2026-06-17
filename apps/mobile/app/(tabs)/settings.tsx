import React, { useState, useEffect, useCallback } from 'react'
import { ActivityIndicator, Alert, Linking, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '@sfp/shared'
import type { UserSettings, SettingsInput } from '@sfp/shared'
import { fetchSettings, saveSettings, resetToDefaults, DEFAULT_SETTINGS_INPUT } from '../../lib/settings'
import { createCheckoutSession } from '../../lib/stats'
import { PaywallModal } from '../../components/ui/PaywallModal'
import { SettingsForm } from '../../components/ui/SettingsForm'

type ScreenState = 'loading' | 'ready' | 'error'

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
      <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted }}>{label}</Text>
      <Text style={{ fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: TYPOGRAPHY.mono.fontSize, color: COLORS.textSecondary }}>{value}</Text>
    </View>
  )
}

function ScoutPreview({ settings, onUpgrade }: { settings: UserSettings; onUpgrade: () => void }) {
  return (
    <>
      <View style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.xl, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm, marginBottom: SPACING.lg, alignItems: 'center' }}>
        <Text style={{ fontFamily: TYPOGRAPHY.h3.fontFamily, fontSize: TYPOGRAPHY.h3.fontSize, fontWeight: TYPOGRAPHY.h3.fontWeight, color: COLORS.textPrimary, marginBottom: SPACING.xs }}>
          Unlock Full Settings
        </Text>
        <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.lg }}>
          Customize fees, thresholds, and sourcing rules on Hustle+
        </Text>
        <TouchableOpacity onPress={onUpgrade}
          style={{ backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl }}>
          <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.elevated }}>
            UPGRADE TO HUSTLE+
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color: COLORS.textMuted, marginBottom: SPACING.sm }}>
        CURRENT SETTINGS
      </Text>
      <View style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm }}>
        <ReadOnlyRow label="eBay Fee"      value={`${settings.ebayFee}%`} />
        <ReadOnlyRow label="Pkg Cost"      value={`$${settings.pkgCost.toFixed(2)}`} />
        <ReadOnlyRow label="Ship Cost"     value={`$${settings.shipCost.toFixed(2)}`} />
        <ReadOnlyRow label="Min Profit"    value={`$${settings.minProfit.toFixed(2)}`} />
        <ReadOnlyRow label="Target ROI"    value={`${settings.targetRoi}%`} />
        <ReadOnlyRow label="Max Days"      value={`${settings.maxDays} days`} />
        <ReadOnlyRow label="Min Title Len" value={`${settings.minStr} chars`} />
        <ReadOnlyRow label="Sourcing"      value={settings.sourcingStyle} />
        <ReadOnlyRow label="Shipping"      value={settings.shipping} />
      </View>
    </>
  )
}

// Change 18: Upgrade Plan section — shown for all non-empire tiers except scout
// (scout sees ScoutPreview which already has an upgrade CTA)
const TIER_NEXT: Record<string, string> = {
  trial:  'hustle',
  hustle: 'stack',
  stack:  'empire',
}

function UpgradeSection({ tier, onUpgrade }: { tier: string; onUpgrade: () => void }) {
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1)
  return (
    <View style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, marginBottom: 2 }}>CURRENT PLAN</Text>
        <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: '600', color: COLORS.textPrimary }}>{tierLabel}</Text>
      </View>
      <TouchableOpacity onPress={onUpgrade}
        style={{ backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md }}>
        <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.elevated }}>UPGRADE</Text>
      </TouchableOpacity>
    </View>
  )
}

function settingsToInput(s: UserSettings): SettingsInput {
  return {
    ebayFee:       s.ebayFee,
    pkgCost:       s.pkgCost,
    shipCost:      s.shipCost,
    minProfit:     s.minProfit,
    targetRoi:     s.targetRoi,
    maxDays:       s.maxDays,
    minStr:        s.minStr,
    sourcingStyle: s.sourcingStyle,
    shipping:      s.shipping,
  }
}

export default function SettingsScreen() {
  const [state, setState]       = useState<ScreenState>('loading')
  const [saved, setSaved]       = useState<UserSettings | null>(null)
  const [tier, setTier]         = useState<string>('scout')
  const [saving, setSaving]     = useState(false)
  const [paywallVisible, setPaywallVisible] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    setErrorMsg(null)
    try {
      const { settings, tier: t } = await fetchSettings()
      setSaved(settings)
      setTier(t)
      setState('ready')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Could not load settings.')
      setState('error')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleSave(input: SettingsInput) {
    setSaving(true)
    try {
      const updated = await saveSettings(input)
      setSaved(updated)
      Alert.alert('Saved', 'Your settings have been updated.')
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    Alert.alert('Reset to Defaults', 'This will restore all settings to their default values.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          setSaving(true)
          try {
            const updated = await resetToDefaults()
            setSaved(updated)
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Could not reset settings.')
          } finally {
            setSaving(false)
          }
        },
      },
    ])
  }

  async function handleUpgrade() {
    try {
      const url = await createCheckoutSession('hustle')
      await Linking.openURL(url)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not open checkout.')
    }
  }

  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1)
  const isScout   = tier === 'scout'

  if (state === 'loading') return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={COLORS.brand} />
    </SafeAreaView>
  )

  if (state === 'error') return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl }}>
      <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.lossText, textAlign: 'center', marginBottom: SPACING.lg }}>{errorMsg}</Text>
      <TouchableOpacity onPress={() => void load()}
        style={{ backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md }}>
        <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.elevated }}>TRY AGAIN</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: TYPOGRAPHY.h2.fontFamily, fontSize: TYPOGRAPHY.h2.fontSize, fontWeight: TYPOGRAPHY.h2.fontWeight, color: COLORS.textPrimary }}>SETTINGS</Text>
        <View style={{ backgroundColor: isScout ? COLORS.surface : COLORS.brand, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 4, borderWidth: 1, borderColor: isScout ? COLORS.border : COLORS.brand }}>
          <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color: isScout ? COLORS.textMuted : COLORS.elevated }}>
            {tierLabel.toUpperCase()}
          </Text>
        </View>
      </View>

      {isScout ? (
        <View style={{ flex: 1, paddingHorizontal: SPACING.xl }}>
          <ScoutPreview settings={saved!} onUpgrade={() => setPaywallVisible(true)} />
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: SPACING.xl }}>
          {tier !== 'empire' && (
            <UpgradeSection tier={tier} onUpgrade={() => setPaywallVisible(true)} />
          )}
          <SettingsForm
            initialValues={saved ? settingsToInput(saved) : DEFAULT_SETTINGS_INPUT}
            onSave={(input) => void handleSave(input)}
            onCancel={() => { /* SettingsForm handles internal cancel */ }}
            onReset={() => void handleReset()}
            saving={saving}
          />
        </View>
      )}

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        featureName="Full Settings"
        requiredTier="hustle"
        onUpgrade={handleUpgrade}
      />
    </SafeAreaView>
  )
}
