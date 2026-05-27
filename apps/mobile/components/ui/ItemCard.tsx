import React from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '@sfp/shared'
import type { InventoryItem, ItemStatus } from '@sfp/shared'
import { ProfitBadge } from './ProfitBadge'

export interface ItemCardProps {
  item: InventoryItem
  onPress?: () => void
}

const STATUS_STYLE: Record<ItemStatus, { bg: string; text: string; label: string }> = {
  'Unlisted':        { bg: COLORS.border,         text: COLORS.textSecondary, label: 'Unlisted'   },
  'Listed':          { bg: `${COLORS.brand}22`,   text: COLORS.brandDim,      label: 'Listed'     },
  'Sold':            { bg: `${COLORS.accent}22`,  text: COLORS.accent,        label: 'Sold'       },
  'Ready to Export': { bg: `${COLORS.warning}22`, text: COLORS.warningText,   label: 'Export'     },
}

export function ItemCard({ item, onPress }: ItemCardProps) {
  const status      = STATUS_STYLE[item.status]
  const hasPhoto    = item.photos.length > 0
  const profit      = item.sellPrice != null && item.cost != null
    ? item.sellPrice - item.cost
    : null
  const displayName = item.nickname ?? item.sku ?? 'Unnamed Item'
  const thumbnail   = hasPhoto ? item.photos[0] : null

  const content = (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius:    RADIUS.md,
        borderWidth:     1,
        borderColor:     COLORS.border,
        flexDirection:   'row',
        overflow:        'hidden',
        ...SHADOWS.sm,
      }}
    >
      {/* Thumbnail or placeholder */}
      <View
        style={{
          width:           72,
          backgroundColor: COLORS.border,
          alignItems:      'center',
          justifyContent:  'center',
        }}
      >
        {thumbnail != null ? (
          <Image
            source={{ uri: thumbnail }}
            style={{ width: 72, height: '100%' as unknown as number }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width:           40,
              height:          40,
              borderRadius:    RADIUS.sm,
              backgroundColor: COLORS.borderStrong,
              alignItems:      'center',
              justifyContent:  'center',
            }}
          >
            <Text style={{ color: COLORS.textMuted, fontSize: 18 }}>📦</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1, padding: SPACING.md }}>
        {/* Row 1: name + status badge */}
        <View className="flex-row items-center justify-between mb-1">
          <Text
            numberOfLines={1}
            style={{
              flex:       1,
              fontFamily: TYPOGRAPHY.body.fontFamily,
              fontSize:   TYPOGRAPHY.body.fontSize,
              fontWeight: TYPOGRAPHY.body.fontWeight,
              color:      COLORS.textPrimary,
              marginRight: SPACING.sm,
            }}
          >
            {displayName}
          </Text>
          <View
            style={{
              backgroundColor: status.bg,
              borderRadius:    RADIUS.sm,
              paddingHorizontal: SPACING.xs + 2,
              paddingVertical:   2,
            }}
          >
            <Text
              style={{
                fontFamily: TYPOGRAPHY.label.fontFamily,
                fontSize:   TYPOGRAPHY.label.fontSize,
                fontWeight: TYPOGRAPHY.label.fontWeight,
                color:      status.text,
              }}
            >
              {status.label}
            </Text>
          </View>
        </View>

        {/* Row 2: SKU + category */}
        <Text
          numberOfLines={1}
          style={{
            fontFamily: TYPOGRAPHY.caption.fontFamily,
            fontSize:   TYPOGRAPHY.caption.fontSize,
            color:      COLORS.textMuted,
            marginBottom: SPACING.sm,
          }}
        >
          {[item.sku, item.category].filter(Boolean).join(' · ') || 'No details'}
        </Text>

        {/* Row 3: cost / sell / profit */}
        <View className="flex-row items-center gap-3">
          {item.cost != null && (
            <View className="items-center">
              <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted }}>
                COST
              </Text>
              <Text style={{ fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: TYPOGRAPHY.mono.fontSize, fontWeight: TYPOGRAPHY.mono.fontWeight, color: COLORS.textPrimary }}>
                ${item.cost.toFixed(2)}
              </Text>
            </View>
          )}

          {item.sellPrice != null && (
            <View className="items-center">
              <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted }}>
                SELL
              </Text>
              <Text style={{ fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: TYPOGRAPHY.mono.fontSize, fontWeight: TYPOGRAPHY.mono.fontWeight, color: COLORS.textPrimary }}>
                ${item.sellPrice.toFixed(2)}
              </Text>
            </View>
          )}

          {profit != null && (
            <View className="items-center">
              <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted }}>
                PROFIT
              </Text>
              <ProfitBadge amount={profit} size="sm" showSign />
            </View>
          )}
        </View>
      </View>
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
      >
        {content}
      </Pressable>
    )
  }

  return content
}
