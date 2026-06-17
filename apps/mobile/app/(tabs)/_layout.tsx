import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { colors } from "../../lib/theme";

// ui-ux-pro-max §9: bottom nav max 5 items, icon + label, active state highlighted
// ui-ux-pro-max §2: touch targets ≥44pt
// ui-ux-pro-max §9: safe area compliance handled by expo-router Tabs

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="scout"
        options={{
          title: "Scout",
          tabBarIcon: ({ color, size }) => (
            // Icon placeholder — replace with @expo/vector-icons or react-native-vector-icons
            null
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="listing"
        options={{
          title: "Listing",
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: "Pulse",
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="pnl"
        options={{
          title: "P&L",
          tabBarIcon: () => null,
        }}
      />
      {/* Stats tab hidden — content migrated to pnl.tsx (Change 9) */}
      <Tabs.Screen
        name="stats"
        options={{
          href: null,
          title: "Stats",
        }}
      />
      {/* Settings is not a visible tab — navigate to it via router.push('/(tabs)/settings') */}
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          title: "Settings",
        }}
      />
    </Tabs>
  );
}
