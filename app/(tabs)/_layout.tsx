import { Feather } from '@expo/vector-icons';
import { Tabs, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { ProfileAvatarButton } from '../../src/components/ProfileAvatarButton';
import { APP_TABS } from '../../src/navigation/tabs';
import { getAuthSession } from '../../src/services/account';
import type { AuthSession } from '../../src/types';
import { type, typography } from '../../src/theme';
import { useTheme } from '../../src/hooks/useTheme';

export default function TabLayout() {
  const palette = useTheme();
  const [session, setSession] = useState<AuthSession | null>(null);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      void getAuthSession()
        .then((nextSession) => {
          if (!cancelled) {
            setSession(nextSession);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSession(null);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <Tabs
      screenOptions={{
        headerRight: () => (
          <ProfileAvatarButton
            avatarUrl={session?.user.avatarUrl}
            email={session?.user.email}
            name={session?.user.name}
            onPress={() => router.push('/account')}
          />
        ),
        headerStyle: { backgroundColor: palette.paper },
        headerShadowVisible: false,
        headerTintColor: palette.ink,
        headerTitleStyle: {
          color: palette.ink,
          ...typography.headingSans,
          ...type.heading,
        },
        sceneStyle: { backgroundColor: palette.paper },
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.faintInk,
        tabBarStyle: {
          backgroundColor: palette.paper,
          // A hairline, not a rule — the old border read as a hard edge under
          // every screen.
          borderTopColor: palette.lineSoft,
          height: 78,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          ...typography.label,
          ...type.caption,
        },
      }}
    >
      {APP_TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            headerTitle: tab.showHeaderTitle ? tab.title : '',
            tabBarLabel: tab.label,
            tabBarIcon: ({ color, size }) => <Feather name={tab.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
