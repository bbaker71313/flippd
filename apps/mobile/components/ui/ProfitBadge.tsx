import React from 'react'
import { Text, View } from 'react-native'
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@sfp/shared'

export interface ProfitBadgeProps {
  amount: number
  size?: 'sm' | 'md' | 'lg'
  showSign?: boolean
  showBackground?: boolean
}

const SIZE_STYLE = {
  sm: {
    fontSize:   TYPOGRAPHY.caption.fontSize,
    fontFamily: TYPOGRAPHY.mono.fontFamily,
    fontWeight: TYPOGRAPHY.mono.fontWeight as '600',
    paddingHorizontal: SPACING.xs,
    paddingVertical:   2,
    borderRadius: RADIUS.sm,
  },
  md: {
    fontSize:   TYPOGRAPHY.mono.fontSize,
    fontFamily: TYPOGRAPHY.mono.fontFamily,
    fontWeight: TYPOGRAPHY.mono.fontWeight as '600',
    paddingHorizontal: SPACING.sm,
    paddingVertical:   SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  lg: {
    fontSize:   TYPOGRAPHY.h3.fontSize,
    fontFamily: TYPOGRAPHY.mono.fontFamily,
    fontWeight: '700' as '700',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    borderRadius: RADIUS.md,
  },
} as const

function getAmountColor(amount: number): string {
  if (amount > 0) return COLORS.profitText
  if (amount < 0) return COLORS.lossText
  return COLORS.textMuted
}

function getBackgroundColor(amount: number): string {
  if (amount > 0) return `${COLORS.profit}1a`   // 10% opacity green
  if (amount < 0) return `${COLORS.loss}1a`     // 10% opacity red
  return COLORS.border
}

function formatAmount(amount: number, showSign: boolean): string {
  const abs  = Math.abs(amount).toFixed(2)
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : showSign ? '+' : ''
  return `${sign}$${abs}`
}

export function ProfitBadge({
  amount,
  size = 'md',
  showSign = true,
  showBackground = false,
}: ProfitBadgeProps) {
  const sizeStyle  = SIZE_STYLE[size]
  const textColor  = getAmountColor(amount)
  const label      = formatAmount(amount, showSign)

  if (showBackground) {
    return (
      <View
        style={{
          backgroundColor: getBackgroundColor(amount),
          borderRadius:    sizeStyle.borderRadius,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          paddingVertical:   sizeStyle.paddingVertical,
          alignSelf: 'flex-start',
        }}
      >
        <Text
          style={{
            fontFamily: sizeStyle.fontFamily,
            fontSize:   sizeStyle.fontSize,
            fontWeight: sizeStyle.fontWeight,
            color: textColor,
          }}
        >
          {label}
        </Text>
      </View>
    )
  }

  return (
    <Text
      style={{
        fontFamily: sizeStyle.fontFamily,
        fontSize:   sizeStyle.fontSize,
        fontWeight: sizeStyle.fontWeight,
        color: textColor,
      }}
    >
      {label}
    </Text>
  )
}
