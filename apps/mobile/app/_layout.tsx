import "../global.css";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import * as Sentry from "@sentry/react-native";
import { supabase } from "../lib/supabase";
import { hasCompletedOnboarding } from "../lib/onboarding";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
});

export default function RootLayout() {
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Initial session + onboarding check — errors treated as unauthenticated/incomplete
    Promise.all([
      supabase.auth.getSession()
        .then(({ data }) => setSession(data.session))
        .catch(() => setSession(null)),
      hasCompletedOnboarding()
        .then(setOnboardingDone)
        .catch(() => setOnboardingDone(false)),
    ]).finally(() => setChecked(true));

    // Mid-session changes (token refresh, sign-out, sign-in from another screen)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Hold a blank screen while the async session/onboarding check runs — prevents any flash
  if (!checked) {
    return <View style={{ flex: 1, backgroundColor: '#0a0a0a' }} />;
  }

  const inAuth = segments[0] === '(auth)';
  const inOnboarding = segments[0] === '(onboarding)';

  return (
    <SafeAreaProvider>
      {/* Unauthenticated user on a protected route → login */}
      {!session && !inAuth && !inOnboarding && <Redirect href="/(auth)/login" />}
      {/* Authenticated user who hasn't completed onboarding → onboarding flow */}
      {session && !onboardingDone && !inOnboarding && <Redirect href="/(onboarding)/identity" />}
      {/* Authenticated + onboarded user on an auth or onboarding screen → scout tab */}
      {session && onboardingDone && (inAuth || inOnboarding) && <Redirect href="/(tabs)/scout" />}

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
