import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScanResult } from "../../components/ui";
import { TYPOGRAPHY } from "@sfp/shared";
import {
  DEMO_SCAN_RESULT,
  DEMO_SOLD_RANGE,
  DEMO_AVG_DAYS_TO_SELL,
} from "../../lib/onboardingDemoData";

export default function ResultScreen() {
  const router = useRouter();

  function handleContinue() {
    router.push("/(onboarding)/how-it-works");
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="flex-1 justify-center px-6">
        <Text className="text-slate-400 text-xs uppercase tracking-widest text-center mb-4">
          Sample scan
        </Text>

        <ScanResult {...DEMO_SCAN_RESULT} onBuy={handleContinue} onPass={handleContinue} />

        <Text
          className="text-center mt-4"
          style={{
            fontFamily: TYPOGRAPHY.caption.fontFamily,
            fontSize: TYPOGRAPHY.caption.fontSize,
            color: "#94a3b8",
          }}
        >
          Sold range {DEMO_SOLD_RANGE} · {DEMO_AVG_DAYS_TO_SELL} days avg to sell
        </Text>
      </View>
    </SafeAreaView>
  );
}
