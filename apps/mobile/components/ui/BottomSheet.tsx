import React, { useEffect, useRef } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native'
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@sfp/shared'

export interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  snapPoint?: '40%' | '60%' | '80%' | 'full'
}

const SNAP_RATIO: Record<NonNullable<BottomSheetProps['snapPoint']>, number> = {
  '40%':  0.40,
  '60%':  0.60,
  '80%':  0.80,
  'full': 1.00,
}

export function BottomSheet({
  visible,
  onClose,
  children,
  title,
  snapPoint = '60%',
}: BottomSheetProps) {
  const screenH = Dimensions.get('window').height
  const sheetH  = screenH * SNAP_RATIO[snapPoint]
  const slideY  = useRef(new Animated.Value(sheetH)).current

  useEffect(() => {
    if (visible) {
      Animated.timing(slideY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start()
    } else {
      Animated.timing(slideY, {
        toValue: sheetH,
        duration: 250,
        useNativeDriver: true,
      }).start()
    }
  }, [visible, sheetH, slideY])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop — COLORS.inverse (#000000) at ~55% opacity via #RRGGBBAA */}
      <Pressable
        className="flex-1"
        style={{ backgroundColor: `${COLORS.inverse}8c` }}
        onPress={onClose}
      />

      {/* Sheet */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: sheetH,
          backgroundColor:    COLORS.elevated,
          borderTopLeftRadius:  RADIUS.lg,
          borderTopRightRadius: RADIUS.lg,
          transform: [{ translateY: slideY }],
        }}
      >
        {/* Drag handle */}
        <View className="items-center pt-3 pb-1">
          <View
            style={{
              width:           40,
              height:          SPACING.xs,   // was 4 — SPACING.xs = 4
              backgroundColor: COLORS.borderStrong,
              borderRadius:    RADIUS.full,
            }}
          />
        </View>

        {/* Title */}
        {title != null && (
          <View
            className="flex-row items-center justify-between"
            style={{
              paddingHorizontal: SPACING.xl,
              paddingVertical:   SPACING.md,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border,
            }}
          >
            <Text
              style={{
                fontFamily: TYPOGRAPHY.h3.fontFamily,
                fontSize:   TYPOGRAPHY.h3.fontSize,
                fontWeight: TYPOGRAPHY.h3.fontWeight,
                color:      COLORS.textPrimary,
              }}
            >
              {title}
            </Text>
            <Pressable onPress={onClose} className="p-1">
              <Text
                style={{
                  color:      COLORS.textMuted,
                  fontSize:   TYPOGRAPHY.h3.fontSize, // was hardcoded 20 — h3 = 20px
                  lineHeight: TYPOGRAPHY.h3.lineHeight,
                }}
              >
                ✕
              </Text>
            </Pressable>
          </View>
        )}

        {/* Content */}
        <View style={{ flex: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.md }}>
          {children}
        </View>
      </Animated.View>
    </Modal>
  )
}
