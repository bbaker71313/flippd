import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { verifyOtp } from "../../lib/auth";

export default function VerifyScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    setError(null);
    if (!token || token.length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    try {
      await verifyOtp({ email: email ?? "", token: token.trim() });
      router.replace("/(tabs)/scout");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("invalid")) {
        setError("Code expired or invalid. Request a new one.");
      } else {
        setError(msg || "Verification failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-white mb-1">Check your email</Text>
        <Text className="text-slate-400 text-sm mb-2">
          We sent a 6-digit code to
        </Text>
        <Text className="text-emerald-400 text-sm font-medium mb-8">{email}</Text>

        <Text className="text-slate-300 text-xs font-medium mb-1 uppercase tracking-wider">Verification Code</Text>
        <TextInput
          className="bg-slate-800 text-white rounded-xl px-4 py-4 mb-6 text-2xl text-center tracking-widest font-mono"
          placeholder="000000"
          placeholderTextColor="#64748b"
          keyboardType="number-pad"
          maxLength={6}
          value={token}
          onChangeText={setToken}
        />

        {error ? (
          <View className="bg-red-950 border border-red-700 rounded-xl px-4 py-3 mb-4">
            <Text className="text-red-400 text-sm">{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          className="bg-emerald-500 rounded-xl py-4 items-center"
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">Verify Email</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="mt-6 items-center"
          onPress={() => router.back()}
        >
          <Text className="text-slate-500 text-sm">Wrong email? Go back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
