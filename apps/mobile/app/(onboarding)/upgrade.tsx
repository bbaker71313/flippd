import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Card, Button } from "../../components/ui";
import { COLORS, TIER_CONFIGS } from "@sfp/shared";
import { markOnboardingComplete } from "../../lib/onboarding";
import { DEMO_SCAN_RESULT } from "../../lib/onboardingDemoData";

export default function UpgradeScreen() {
  const router = useRouter();
  const hustle = TIER_CONFIGS.hustle;

  async function finish(destination: "/(tabs)/scout" | "/(tabs)/settings") {
    await markOnboardingComplete();
    router.replace(destination);
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="flex-1 px-6 pt-12">
        <Text className="text-3xl font-bold text-white mb-2">
          You just found a ${DEMO_SCAN_RESULT.estimatedProfit.toFixed(2)} flip.
        </Text>
        <Text className="text-slate-400 text-sm mb-8">
          Imagine doing this all day, every aisle.
        </Text>

        <Card padding="lg">
          <Text style={{ color: COLORS.brandDim, fontWeight: "700", marginBottom: 8 }}>
            {hustle.label.toUpperCase()} · ${hustle.priceMonthly}/mo
          </Text>
          {hustle.features.slice(0, 3).map((f) => (
            <Text key={f} style={{ color: COLORS.textSecondary, marginTop: 4 }}>
              • {f}
            </Text>
          ))}
        </Card>
      </View>

      <View className="px-6 pb-8 gap-3">
        <Button
          label="See Hustle Plans"
          variant="secondary"
          size="lg"
          onPress={() => void finish("/(tabs)/settings")}
        />
        <Button
          label="Start with Scout (Free)"
          variant="primary"
          size="lg"
          onPress={() => void finish("/(tabs)/scout")}
        />
      </View>
    </SafeAreaView>
  );
}
