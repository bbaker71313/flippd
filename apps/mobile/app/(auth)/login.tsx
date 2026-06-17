import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { signIn } from "../../lib/auth";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
    <SafeAreaView className="flex-1 bg-stone-950">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Logo / brand */}
        <View className="flex-1 justify-center px-6">
          <View className="items-center mb-10">
            <View className="w-20 h-20 rounded-2xl bg-emerald-500 items-center justify-center mb-4"
              style={{ shadowColor: "#10b981", shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 }}
            >
              <Ionicons name="scan" size={40} color="#fff" />
            </View>
            <Text className="text-white text-3xl font-bold tracking-tight">ScanForProfit</Text>
            <Text className="text-stone-400 text-sm mt-1">Turn thrift finds into cash</Text>
          </View>

          {/* Form */}
          <View className="bg-stone-900 rounded-2xl p-5 mb-4"
            style={{ borderWidth: 1, borderColor: "#292524" }}
          >
            <Text className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-1">Email</Text>
            <TextInput
              className="text-white text-base py-3 border-b border-stone-700 mb-4"
              placeholder="you@email.com"
              placeholderTextColor="#57534e"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />

            <Text className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-1">Password</Text>
            <View className="flex-row items-center border-b border-stone-700">
              <TextInput
                className="flex-1 text-white text-base py-3"
                placeholder="Your password"
                placeholderTextColor="#57534e"
                secureTextEntry={!showPassword}
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} className="pl-2 py-3">
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={18} color="#78716c" />
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <View className="bg-red-950/80 border border-red-800 rounded-xl px-4 py-3 mb-4 flex-row items-center gap-2">
              <Ionicons name="alert-circle" size={16} color="#f87171" />
              <Text className="text-red-400 text-sm flex-1">{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            className="bg-emerald-500 rounded-2xl py-4 items-center"
            style={{ shadowColor: "#10b981", shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 }}
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
            <Text className="text-stone-400 text-sm">
              New here?{" "}
              <Text className="text-emerald-400 font-semibold">Create an account</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
