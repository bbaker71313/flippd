import { useState } from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Card, Button } from "../../components/ui";
import { COLORS } from "@sfp/shared";

const RESELLER_TYPES = [
  { id: "thrift", label: "Thrift Store Flipper" },
  { id: "ebay", label: "eBay Seller" },
  { id: "side", label: "Side Hustler" },
  { id: "fulltime", label: "Full-Time Reseller" },
] as const;

export default function IdentityScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="flex-1 px-6 pt-12">
        <Text className="text-3xl font-bold text-white mb-2">
          What kind of reseller are you?
        </Text>
        <Text className="text-slate-400 text-sm mb-8">
          We'll tailor your experience to how you source.
        </Text>

        <View className="gap-3">
          {RESELLER_TYPES.map((type) => (
            <Card key={type.id} onPress={() => setSelected(type.id)} padding="md">
              <Text
                style={{
                  color: selected === type.id ? COLORS.brandDim : COLORS.textPrimary,
                  fontWeight: selected === type.id ? "700" : "400",
                }}
              >
                {type.label}
              </Text>
            </Card>
          ))}
        </View>
      </View>

      <View className="px-6 pb-8">
        <Button
          label="Continue"
          variant="primary"
          size="lg"
          disabled={!selected}
          onPress={() => router.push("/(onboarding)/permission")}
        />
      </View>
    </SafeAreaView>
  );
}
