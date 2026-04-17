import { Feather } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { ProfileAvatarButton } from '../../src/components/ProfileAvatarButton';
import { APP_TABS } from '../../src/navigation/tabs';
import { getAuthSession } from '../../src/services/account';
import type { AuthSession } from '../../src/types';
import { palette, typography } from '../../src/theme';

export default function TabLayout() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    getAuthSession()
      .then((nextSession) => {
        if (isMounted) {
          setSession(nextSession);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSession(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerRight: () => (
          <ProfileAvatarButton
            name={session?.user.name}
            email={session?.user.email}
            avatarUrl={session?.user.avatarUrl}
            onPress={() => router.push('/account')}
          />
        ),
        headerStyle: { backgroundColor: palette.paper },
        headerTintColor: palette.ink,
        headerTitleStyle: {
          color: palette.ink,
          fontSize: 18,
          ...typography.heading,
        },
        sceneStyle: { backgroundColor: palette.paper },
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.mutedInk,
        tabBarStyle: {
          backgroundColor: palette.paper,
          borderTopColor: palette.line,
          height: 78,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontFamily: typography.label.fontFamily,
          fontSize: 12,
        },
      }}
    >
      {APP_TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarLabel: tab.label,
            tabBarIcon: ({ color, size }) => <Feather name={tab.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
