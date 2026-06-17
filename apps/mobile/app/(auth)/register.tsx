import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { signUp } from "../../lib/auth";

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleRegister() {
    setError(null);
    if (!email || !username || !password) {
      setError("All fields are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await signUp({ email, password, username });
      router.push({ pathname: "/(auth)/verify", params: { email } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed. Try again.");
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
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} className="px-6" keyboardShouldPersistTaps="handled">
          {/* Logo / brand */}
          <View className="items-center mb-8 mt-4">
            <View className="w-16 h-16 rounded-2xl bg-emerald-500 items-center justify-center mb-3"
              style={{ shadowColor: "#10b981", shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 }}
            >
              <Ionicons name="scan" size={32} color="#fff" />
            </View>
            <Text className="text-white text-2xl font-bold tracking-tight">Create Account</Text>
            <Text className="text-stone-400 text-sm mt-1">Start flipping smarter.</Text>
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

            <Text className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-1">Username</Text>
            <TextInput
              className="text-white text-base py-3 border-b border-stone-700 mb-4"
              placeholder="yourname"
              placeholderTextColor="#57534e"
              autoCapitalize="none"
              autoComplete="username"
              value={username}
              onChangeText={setUsername}
            />

            <Text className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-1">Password</Text>
            <View className="flex-row items-center border-b border-stone-700 mb-4">
              <TextInput
                className="flex-1 text-white text-base py-3"
                placeholder="Min 8 characters"
                placeholderTextColor="#57534e"
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} className="pl-2 py-3">
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={18} color="#78716c" />
              </TouchableOpacity>
            </View>

            <Text className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-1">Confirm Password</Text>
            <TextInput
              className="text-white text-base py-3"
              placeholder="Repeat password"
              placeholderTextColor="#57534e"
              secureTextEntry={!showPassword}
              value={confirm}
              onChangeText={setConfirm}
            />
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
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-6 mb-8 items-center"
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text className="text-stone-400 text-sm">
              Already have an account?{" "}
              <Text className="text-emerald-400 font-semibold">Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
