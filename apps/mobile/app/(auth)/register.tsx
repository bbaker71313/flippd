import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RegisterScreen() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 justify-center px-6">
        <Text className="text-2xl font-bold text-slate-900 mb-2">
          Create account
        </Text>
        <Text className="text-base text-slate-500">
          Register screen — stub
        </Text>
      </View>
    </SafeAreaView>
  );
}
