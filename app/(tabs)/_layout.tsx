import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { APP_TABS } from '../../src/navigation/tabs';
import { palette, typography } from '../../src/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
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
