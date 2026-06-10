import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useCameraPermissions } from "expo-camera";
import { Button } from "../../components/ui";

export default function PermissionScreen() {
  const router = useRouter();
  const [, requestPermission] = useCameraPermissions();

  async function handleAllowCamera() {
    await requestPermission();
    router.push("/(onboarding)/result");
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-white mb-2">Try a scan.</Text>
        <Text className="text-slate-400 text-sm leading-relaxed mb-12">
          Point your camera at any item — a thrift store find, a garage sale
          table, anything. We'll show you what it's worth in seconds.
        </Text>

        <View className="gap-3">
          <Button
            label="Allow Camera"
            variant="primary"
            size="lg"
            onPress={() => void handleAllowCamera()}
          />
          <Button
            label="Scan Sample Item"
            variant="ghost"
            size="lg"
            onPress={() => router.push("/(onboarding)/result")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
