import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { router, Stack, usePathname } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { bootstrapApp } from '../src/services/bootstrap';
import { getHasSeenOnboarding } from '../src/services/onboarding';
import { getStartupPresentation } from '../src/startup';
import { palette, resolveTypography } from '../src/theme';
import { shouldPresentOnboarding } from '../src/onboarding/model';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(true);
  const pathname = usePathname();
  const [fontsLoaded, fontsError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    let cancelled = false;

    async function prepareApp() {
      try {
        await bootstrapApp();

        let didSeeOnboarding = true;

        try {
          didSeeOnboarding = await getHasSeenOnboarding();
        } catch {
          didSeeOnboarding = true;
        }

        if (cancelled) {
          return;
        }

        setHasSeenOnboarding(didSeeOnboarding);
        setIsReady(true);
      } catch (bootstrapError) {
        if (cancelled) {
          return;
        }

        setError(bootstrapError instanceof Error ? bootstrapError.message : 'Bootstrap failed');
      }
    }

    void prepareApp();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isReady || error || !pathname) {
      return;
    }

    let cancelled = false;

    async function ensureLatestOnboardingState() {
      if (!shouldPresentOnboarding({ hasSeenOnboarding, pathname })) {
        return;
      }

      let latestHasSeenOnboarding = true;

      try {
        latestHasSeenOnboarding = await getHasSeenOnboarding();
      } catch {
        latestHasSeenOnboarding = true;
      }

      if (cancelled) {
        return;
      }

      setHasSeenOnboarding(latestHasSeenOnboarding);

      if (shouldPresentOnboarding({ hasSeenOnboarding: latestHasSeenOnboarding, pathname })) {
        router.replace('/onboarding');
      }
    }

    void ensureLatestOnboardingState();

    return () => {
      cancelled = true;
    };
  }, [error, hasSeenOnboarding, isReady, pathname]);

  const startupPresentation = getStartupPresentation({
    isReady,
    error,
    fontsLoaded,
    fontsError,
  });
  const resolvedTypography = resolveTypography(startupPresentation.useCustomFonts);

  if (startupPresentation.screen === 'error') {
    return (
      <View style={styles.centered}>
        <StatusBar style="dark" />
        <Text style={styles.statusTitle}>App bootstrap failed</Text>
        <Text style={styles.statusBody}>{error}</Text>
      </View>
    );
  }

  if (startupPresentation.screen === 'loading') {
    return (
      <View style={styles.centered}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.statusBody}>Preparing local storage…</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.paper },
          headerTintColor: palette.ink,
          headerTitleStyle: {
            color: palette.ink,
            fontSize: 18,
            ...resolvedTypography.heading,
          },
          contentStyle: { backgroundColor: palette.paper },
        }}
      >
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ title: 'Meetings' }} />
        <Stack.Screen name="account" options={{ title: 'Account' }} />
        <Stack.Screen name="record" options={{ title: 'New Recording' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="meetings/[id]" options={{ title: 'Meeting' }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.paper,
    padding: 24,
    gap: 12,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.ink,
  },
  statusBody: {
    fontSize: 15,
    color: palette.mutedInk,
    textAlign: 'center',
  },
});
