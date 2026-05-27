import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 justify-center px-6">
        <Text className="text-2xl font-bold text-slate-900 mb-2">
          Sign in
        </Text>
        <Text className="text-base text-slate-500">
          Login screen — stub
        </Text>
      </View>
    </SafeAreaView>
  );
}
