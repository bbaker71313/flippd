import React, { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import type { KeyboardTypeOptions } from 'react-native'
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@sfp/shared'

export interface InputProps {
  value: string
  onChangeText: (text: string) => void
  label?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  multiline?: boolean
  keyboardType?: KeyboardTypeOptions
  secureTextEntry?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export function Input({
  value,
  onChangeText,
  label,
  placeholder,
  error,
  disabled = false,
  multiline = false,
  keyboardType,
  secureTextEntry = false,
  leftIcon,
  rightIcon,
}: InputProps) {
  const [focused, setFocused] = useState(false)

  const borderColor = error
    ? COLORS.loss
    : focused
      ? COLORS.brand
      : COLORS.border

  return (
    <View className="w-full">
      {label != null && (
        <Text
          className="mb-1"
          style={{
            fontFamily:    TYPOGRAPHY.label.fontFamily,
            fontSize:      TYPOGRAPHY.label.fontSize,
            fontWeight:    TYPOGRAPHY.label.fontWeight,
            color:         COLORS.textMuted,
            letterSpacing: TYPOGRAPHY.label.fontSize * 0.06, // brand guide: type.label +0.06em
          }}
        >
          {label}
        </Text>
      )}

      <View
        className="flex-row items-center"
        style={{
          backgroundColor: disabled ? COLORS.border : COLORS.surface,
          borderWidth:     1.5,
          borderColor,
          borderRadius:    RADIUS.md,
          paddingHorizontal: SPACING.md,
          minHeight: multiline ? SPACING.xxl * 2 : SPACING.xxl,
        }}
      >
        {leftIcon != null && (
          <View className="mr-2">{leftIcon}</View>
        )}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          editable={!disabled}
          multiline={multiline}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1"
          style={{
            fontFamily:        TYPOGRAPHY.body.fontFamily,
            fontSize:          TYPOGRAPHY.body.fontSize,
            fontWeight:        TYPOGRAPHY.body.fontWeight,
            color:             disabled ? COLORS.textMuted : COLORS.textPrimary,
            paddingVertical:   SPACING.sm,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />

        {rightIcon != null && (
          <View className="ml-2">{rightIcon}</View>
        )}
      </View>

      {error != null && (
        <Text
          className="mt-1"
          style={{
            fontFamily:  TYPOGRAPHY.caption.fontFamily,
            fontSize:    TYPOGRAPHY.caption.fontSize,
            lineHeight:  TYPOGRAPHY.caption.lineHeight, // was missing
            color:       COLORS.lossText,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  )
}
