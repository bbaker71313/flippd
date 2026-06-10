import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Card, Button } from "../../components/ui";
import { COLORS } from "@sfp/shared";

const STEPS = [
  "Scan any item or shelf",
  "Get BUY, HOT, or PASS with profit math from real eBay sold data",
  "Track it in Inventory",
  "See your real numbers in Stats",
];

export default function HowItWorksScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="flex-1 px-6 pt-12">
        <Text className="text-3xl font-bold text-white mb-2">How this works</Text>
        <Text className="text-slate-400 text-sm mb-8">No guessing. Just market reality.</Text>

        <View className="gap-3">
          {STEPS.map((step, i) => (
            <Card key={step} padding="md">
              <View className="flex-row items-start gap-3">
                <Text style={{ color: COLORS.brandDim, fontWeight: "700" }}>{i + 1}</Text>
                <Text style={{ color: COLORS.textPrimary, flex: 1 }}>{step}</Text>
              </View>
            </Card>
          ))}
        </View>
      </View>

      <View className="px-6 pb-8">
        <Button
          label="Continue"
          variant="primary"
          size="lg"
          onPress={() => router.push("/(onboarding)/upgrade")}
        />
      </View>
    </SafeAreaView>
  );
}
