import "../global.css";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import * as Sentry from "@sentry/react-native";
import { supabase } from "../lib/supabase";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
});

export default function RootLayout() {
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Initial session check — errors treated as unauthenticated
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setChecked(true));

    // Mid-session changes (token refresh, sign-out, sign-in from another screen)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Hold a blank screen while the async session check runs — prevents any flash
  if (!checked) {
    return <View style={{ flex: 1, backgroundColor: '#1c1712' }} />;
  }

  const inAuth = segments[0] === '(auth)';

  return (
    <SafeAreaProvider>
      {/* Unauthenticated user on a protected route → login */}
      {!session && !inAuth && <Redirect href="/(auth)/login" />}
      {/* Authenticated user on an auth screen → scout tab */}
      {session && inAuth && <Redirect href="/(tabs)/scout" />}

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
