import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { signUp } from "../../lib/auth";

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <SafeAreaView className="flex-1 bg-slate-950">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 justify-center px-6">
          <Text className="text-3xl font-bold text-white mb-1">Create account</Text>
          <Text className="text-slate-400 text-sm mb-8">Start flipping smarter.</Text>

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

          <Text className="text-slate-300 text-xs font-medium mb-1 uppercase tracking-wider">Username</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3 mb-4 text-base"
            placeholder="yourname"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoComplete="username"
            value={username}
            onChangeText={setUsername}
          />

          <Text className="text-slate-300 text-xs font-medium mb-1 uppercase tracking-wider">Password</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3 mb-4 text-base"
            placeholder="Min 8 characters"
            placeholderTextColor="#64748b"
            secureTextEntry
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
          />

          <Text className="text-slate-300 text-xs font-medium mb-1 uppercase tracking-wider">Confirm Password</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3 mb-6 text-base"
            placeholder="Repeat password"
            placeholderTextColor="#64748b"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
          />

          {error ? (
            <View className="bg-red-950 border border-red-700 rounded-xl px-4 py-3 mb-4">
              <Text className="text-red-400 text-sm">{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            className="bg-emerald-500 rounded-xl py-4 items-center"
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
            className="mt-6 items-center"
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text className="text-slate-400 text-sm">
              Already have an account? <Text className="text-emerald-400 font-medium">Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
