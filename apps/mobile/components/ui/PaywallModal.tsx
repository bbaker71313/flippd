import React from 'react'
import { ActivityIndicator, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native'
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '@sfp/shared'

// Hustle price from constants — never hardcoded in copy
const HUSTLE_PRICE = '$19/mo'

const FEATURE_VALUE_PROPS: Record<string, string> = {
  'Expense Tracking': 'Log supplies, fees, and trips. See your real take-home number.',
  'Mileage Tracker':  'Track sourcing trips. Every mile is a tax deduction.',
  'Full P&L':         'Monthly breakdowns, tax reserve, and net profit history.',
}

export interface PaywallModalProps {
  visible: boolean
  onClose: () => void
  featureName: string
  requiredTier: 'hustle' | 'stack' | 'empire'
  onUpgrade?: () => Promise<void>
}

export function PaywallModal({ visible, onClose, featureName, requiredTier, onUpgrade }: PaywallModalProps) {
  const [loading, setLoading] = React.useState(false)
  const valueProp = FEATURE_VALUE_PROPS[featureName] ?? `${featureName} is available on Hustle and above.`
  const tierLabel = requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)

  async function handleUpgrade() {
    if (!onUpgrade) return
    setLoading(true)
    try { await onUpgrade() } catch { /* caller handles error */ }
    finally { setLoading(false) }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: COLORS.inverse + '99', justifyContent: 'center', alignItems: 'center', padding: SPACING.xl }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}} style={{ width: '100%' }}>
          <View style={{ backgroundColor: COLORS.elevated, borderRadius: RADIUS.lg, padding: SPACING.xl, ...SHADOWS.md }}>
            {/* Feature name */}
            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.brandDim, marginBottom: SPACING.sm }}>
              {featureName.toUpperCase()}
            </Text>
            <Text style={{ fontFamily: TYPOGRAPHY.h3.fontFamily, fontSize: TYPOGRAPHY.h3.fontSize, fontWeight: TYPOGRAPHY.h3.fontWeight, color: COLORS.textPrimary, marginBottom: SPACING.sm }}>
              {valueProp}
            </Text>

            {/* Price */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: SPACING.xl }}>
              <Text style={{ fontFamily: TYPOGRAPHY.display.fontFamily, fontSize: 36, fontWeight: '800', color: COLORS.brand }}>{HUSTLE_PRICE}</Text>
              <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, marginLeft: SPACING.xs }}>
                Hustle plan
              </Text>
            </View>

            {/* CTA */}
            <TouchableOpacity
              onPress={() => void handleUpgrade()}
              disabled={loading || !onUpgrade}
              style={{ backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', marginBottom: SPACING.md }}
            >
              {loading
                ? <ActivityIndicator color={COLORS.elevated} />
                : <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: 14, color: COLORS.elevated }}>
                    Upgrade to {tierLabel}
                  </Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={{ alignItems: 'center', paddingVertical: SPACING.sm }}>
              <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textMuted }}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
