import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { colors } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const icon = (name: IconName) =>
  function TabIcon({ focused, size }: { focused: boolean; size: number }) {
    return <Ionicons name={name} color={focused ? colors.primary : colors.textMuted} size={size} />;
  };

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerTitleAlign: 'center' }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: icon('home') }} />
      <Tabs.Screen
        name="explore"
        options={{ title: t('tabs.explore'), tabBarIcon: icon('medkit') }}
      />
      <Tabs.Screen
        name="appointments"
        options={{ title: t('tabs.appointments'), tabBarIcon: icon('calendar') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: icon('person') }}
      />
    </Tabs>
  );
}
