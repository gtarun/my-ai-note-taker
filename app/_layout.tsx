import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { bootstrapApp } from '../src/services/bootstrap';
import { palette } from '../src/theme';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bootstrapApp()
      .then(() => setIsReady(true))
      .catch((bootstrapError: Error) => {
        setError(bootstrapError.message);
      });
  }, []);

  if (error) {
    return (
      <View style={styles.centered}>
        <StatusBar style="dark" />
        <Text style={styles.title}>App bootstrap failed</Text>
        <Text style={styles.body}>{error}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.centered}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={palette.ink} />
        <Text style={styles.body}>Preparing local storage…</Text>
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
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: palette.paper },
        }}
      >
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.ink,
  },
  body: {
    fontSize: 15,
    color: palette.mutedInk,
    textAlign: 'center',
  },
});
