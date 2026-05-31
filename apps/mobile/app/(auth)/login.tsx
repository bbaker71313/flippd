import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { signIn } from "../../lib/auth";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await signIn({ email, password });
      router.replace("/(tabs)/scout");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.toLowerCase().includes("invalid login") || msg.toLowerCase().includes("wrong")) {
        setError("Wrong email or password.");
      } else if (msg.toLowerCase().includes("email not confirmed")) {
        setError("Email not verified. Check your inbox.");
      } else {
        setError(msg || "Sign in failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 justify-center px-6">
          <Text className="text-3xl font-bold text-white mb-1">Welcome back</Text>
          <Text className="text-slate-400 text-sm mb-8">Sign in to your account.</Text>

          <Text className="text-slate-300 text-xs font-medium mb-1 uppercase tracking-wider">Email</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3 mb-4 text-base"
            placeholder="you@email.com"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />

          <Text className="text-slate-300 text-xs font-medium mb-1 uppercase tracking-wider">Password</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3 mb-6 text-base"
            placeholder="Your password"
            placeholderTextColor="#64748b"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />

          {error ? (
            <View className="bg-red-950 border border-red-700 rounded-xl px-4 py-3 mb-4">
              <Text className="text-red-400 text-sm">{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            className="bg-emerald-500 rounded-xl py-4 items-center"
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-6 items-center"
            onPress={() => router.replace("/(auth)/register")}
          >
            <Text className="text-slate-400 text-sm">
              Don't have an account? <Text className="text-emerald-400 font-medium">Create one</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
