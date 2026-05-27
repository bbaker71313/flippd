import React from 'react'
import { Text, View } from 'react-native'
import { COLORS, TYPOGRAPHY, SPACING } from '@sfp/shared'
import { Button } from './Button'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  message?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ paddingHorizontal: SPACING.xl, paddingVertical: SPACING.xxl }}
    >
      {icon != null && (
        <View style={{ marginBottom: SPACING.lg }}>
          {icon}
        </View>
      )}

      <Text
        className="text-center"
        style={{
          fontFamily:   TYPOGRAPHY.h3.fontFamily,
          fontSize:     TYPOGRAPHY.h3.fontSize,
          fontWeight:   TYPOGRAPHY.h3.fontWeight,
          color:        COLORS.textPrimary,
          marginBottom: message != null ? SPACING.sm : 0,
        }}
      >
        {title}
      </Text>

      {message != null && (
        <Text
          className="text-center"
          style={{
            fontFamily:   TYPOGRAPHY.body.fontFamily,
            fontSize:     TYPOGRAPHY.body.fontSize,
            fontWeight:   TYPOGRAPHY.body.fontWeight,
            color:        COLORS.textMuted,
            lineHeight:   TYPOGRAPHY.body.lineHeight,
            marginBottom: actionLabel != null ? SPACING.xl : 0,
          }}
        >
          {message}
        </Text>
      )}

      {actionLabel != null && onAction != null && (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="primary"
          size="md"
        />
      )}
    </View>
  )
}
