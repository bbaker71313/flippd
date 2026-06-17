import React, { useEffect, useRef, useState } from 'react'
import { Modal, View, Text, TouchableOpacity } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@sfp/shared'
import { usePostHog } from 'posthog-react-native'

const SEEN_KEY = 'sfp_onboarding_complete'

const SCREENS = [
  {
    headline: 'Know before you buy.',
    body: 'ScanForProfit shows you real eBay sold data before you spend a dollar at the thrift store.',
  },
  {
    headline: 'Point. Scan. Decide.',
    body: 'Aim your camera at any item. AI identifies it, pulls sold comps, and gives you a FLIP or PASS in seconds.',
  },
  {
    headline: 'Set your eBay fee once.',
    body: 'Go to Settings and enter your actual eBay fee percentage. Every profit calculation uses your real numbers.',
  },
]

export async function shouldShowOnboarding(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(SEEN_KEY)
  return val === null
}

interface OnboardingSheetProps {
  visible: boolean
  onDone: () => void
}

export function OnboardingSheet({ visible, onDone }: OnboardingSheetProps) {
  const [step, setStep] = useState(0)
  const posthog = usePostHog()
  const firedRef = useRef(false)

  useEffect(() => {
    if (visible && !firedRef.current) {
      firedRef.current = true
      posthog?.capture('onboarding_started')
    }
    if (!visible) {
      firedRef.current = false
      setStep(0)
    }
  }, [visible, posthog])

  async function finish(completed: boolean) {
    await SecureStore.setItemAsync(SEEN_KEY, '1')
    posthog?.capture(completed ? 'onboarding_completed' : 'onboarding_skipped', { at_step: step + 1 })
    onDone()
  }

  const isLast = step === SCREENS.length - 1
  const screen = SCREENS[step]

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => void finish(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <View style={{ backgroundColor: COLORS.elevated, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: 48 }}>
          {/* Step dots */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: SPACING.lg }}>
            {SCREENS.map((_, i) => (
              <View
                key={i}
                style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? COLORS.profit : COLORS.border, marginHorizontal: 3 }}
              />
            ))}
          </View>

          <Text style={{ fontFamily: TYPOGRAPHY.h2.fontFamily, fontSize: TYPOGRAPHY.h2.fontSize, fontWeight: TYPOGRAPHY.h2.fontWeight, color: COLORS.textPrimary, marginBottom: SPACING.md }}>
            {screen.headline}
          </Text>
          <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textMuted, lineHeight: 22, marginBottom: SPACING.xl }}>
            {screen.body}
          </Text>

          <View style={{ flexDirection: 'row' }}>
            {!isLast && (
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: SPACING.md, alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginRight: SPACING.sm }}
                onPress={() => void finish(false)}
              >
                <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted }}>SKIP</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{ flex: isLast ? 1 : 2, paddingVertical: SPACING.md, alignItems: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.profit }}
              onPress={() => isLast ? void finish(true) : setStep((s: number) => s + 1)}
            >
              <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '700', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.inverse }}>
                {isLast ? 'GET STARTED' : 'NEXT'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
