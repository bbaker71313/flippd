import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TrendsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-xl font-semibold text-slate-900">Trends</Text>
        <Text className="text-sm text-slate-500 mt-1">Market trends — stub</Text>
      </View>
    </SafeAreaView>
  );
}
