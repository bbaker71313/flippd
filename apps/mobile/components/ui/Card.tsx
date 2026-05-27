import React from 'react'
import { Pressable, View } from 'react-native'
import { COLORS, RADIUS, SHADOWS, SPACING } from '@sfp/shared'

export interface CardProps {
  children: React.ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
  onPress?: () => void
}

const PADDING_MAP = {
  none: 0,
  sm:   SPACING.sm,
  md:   SPACING.md,
  lg:   SPACING.lg,
} as const

export function Card({ children, padding = 'md', onPress }: CardProps) {
  const sharedStyle = {
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.md,
    borderWidth:     1.5,          // was 1 — crisper instrument-panel edge
    borderColor:     COLORS.border,
    padding:         PADDING_MAP[padding],
    ...SHADOWS.sm,
  }

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [sharedStyle, pressed && { opacity: 0.82 }]}
      >
        {children}
      </Pressable>
    )
  }

  return <View style={sharedStyle}>{children}</View>
}
