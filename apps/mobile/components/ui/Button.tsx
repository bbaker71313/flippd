import React from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@sfp/shared'

export interface ButtonProps {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  icon?: React.ReactNode
}

const VARIANT: Record<
  NonNullable<ButtonProps['variant']>,
  { bg: string; text: string; border?: string; indicator: string }
> = {
  primary:   { bg: COLORS.brand,    text: COLORS.elevated,  indicator: COLORS.elevated },
  secondary: { bg: COLORS.surface,  text: COLORS.brandDim,  border: COLORS.brand, indicator: COLORS.brand },
  ghost:     { bg: 'transparent',   text: COLORS.brandDim,  indicator: COLORS.brand },
  danger:    { bg: COLORS.loss,     text: COLORS.elevated,  indicator: COLORS.elevated },
}

type TypographyEntry = {
  fontFamily: string
  fontSize: number
  fontWeight: TextStyle['fontWeight']
  lineHeight: number
}

// letterSpacing per brand guide: type.label = +0.06em, others default (0)
const SIZE: Record<
  NonNullable<ButtonProps['size']>,
  { height: number; px: number; radius: number; font: TypographyEntry; letterSpacing: number }
> = {
  sm: { height: 36, px: SPACING.md, radius: RADIUS.sm, font: TYPOGRAPHY.label, letterSpacing: TYPOGRAPHY.label.fontSize * 0.06 },
  md: { height: 48, px: SPACING.lg, radius: RADIUS.md, font: TYPOGRAPHY.body,  letterSpacing: 0 },
  lg: { height: 56, px: SPACING.xl, radius: RADIUS.md, font: TYPOGRAPHY.h3,    letterSpacing: 0 },
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
}: ButtonProps) {
  const v = VARIANT[variant]
  const s = SIZE[size]
  const isDisabled = disabled || loading

  const containerStyle: ViewStyle = {
    height: s.height,
    paddingHorizontal: s.px,
    borderRadius: s.radius,
    backgroundColor: v.bg,
    ...(v.border ? { borderWidth: 1.5, borderColor: v.border } : {}),
    opacity: isDisabled ? 0.5 : 1,
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className="flex-row items-center justify-center"
      style={({ pressed }) => [containerStyle, pressed && !isDisabled && { opacity: 0.75 }]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.indicator} />
      ) : (
        <>
          {icon != null && <View className="mr-2">{icon}</View>}
          <Text
            style={{
              color:        v.text,
              fontFamily:   s.font.fontFamily,
              fontSize:     s.font.fontSize,
              fontWeight:   s.font.fontWeight,
              lineHeight:   s.font.lineHeight,
              letterSpacing: s.letterSpacing,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  )
}
