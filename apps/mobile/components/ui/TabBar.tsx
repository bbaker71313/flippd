import React from 'react'
import { Platform, Text, View } from 'react-native'
import { Tabs } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { COLORS, ICONS, TYPOGRAPHY, SPACING } from '@sfp/shared'

// Tab icon map — Feather icon names for each route
type FeatherIconName = React.ComponentProps<typeof Feather>['name']

const TAB_ICONS: Record<string, FeatherIconName> = {
  scout:     'camera',
  inventory: 'package',
  listing:   'tag',
  trends:    'trending-up',
  stats:     'bar-chart-2',
}

const TAB_LABELS: Record<string, string> = {
  scout:     'Scout',
  inventory: 'Inventory',
  listing:   'Listing',
  trends:    'Trends',
  stats:     'Stats',
}

export interface TabBarProps {
  // Follows Expo Router Tabs component pattern — no external props required
  // Pass via <Tabs tabBar={...}> or use as a direct layout wrapper
}

/** Drop-in replacement for the (tabs)/_layout.tsx default export. */
export function TabBar(_props: TabBarProps) {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   COLORS.brand,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor:  COLORS.border,
          borderTopWidth:  1,
          height:          Platform.OS === 'ios' ? 88 : 64,
          paddingBottom:   Platform.OS === 'ios' ? 28 : SPACING.sm,
          paddingTop:      SPACING.sm,   // was 8 — SPACING.sm = 8
        },
        tabBarIcon: ({ color }) => {
          // Feather does not accept strokeWidth — color alone signals active/inactive
          const iconName = TAB_ICONS[route.name] ?? 'circle'
          return (
            <Feather
              name={iconName}
              size={ICONS.size.lg}
              color={color}
            />
          )
        },
        tabBarLabel: ({ color }) => (
          <Text
            style={{
              fontFamily:    TYPOGRAPHY.label.fontFamily,
              fontSize:      TYPOGRAPHY.label.fontSize,
              fontWeight:    TYPOGRAPHY.label.fontWeight,
              color,
              marginTop:     2,
              letterSpacing: TYPOGRAPHY.label.fontSize * 0.06, // brand guide: type.label +0.06em
            }}
          >
            {TAB_LABELS[route.name] ?? route.name}
          </Text>
        ),
      })}
    >
      <Tabs.Screen name="scout"     />
      <Tabs.Screen name="inventory" />
      <Tabs.Screen name="listing"   />
      <Tabs.Screen name="trends"    />
      <Tabs.Screen name="stats"     />
    </Tabs>
  )
}
