import '@/i18n';

import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

import { CrashScreen } from '@/components/CrashScreen';
import { OfflineBanner } from '@/components/OfflineBanner';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { AlertWatcher } from '@/features/sos/AlertWatcher';
// Registers the background location task at start-up (required by expo-task-manager).
import '@/features/responder/tracking';

// expo-router shows this if any screen crashes (with 108 / 112 still on it).
export { CrashScreen as ErrorBoundary };

export default function RootLayout() {
  const { t } = useTranslation();
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <AlertWatcher />
      <OfflineBanner />
      <Stack screenOptions={{ headerTitleAlign: 'center' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ title: t('auth.signInTitle') }} />
        <Stack.Screen name="verify" options={{ title: t('auth.verifyTitle') }} />
        <Stack.Screen name="emergency-contacts" options={{ title: t('contacts.title') }} />
        <Stack.Screen name="clinic/[id]" options={{ title: '' }} />
        <Stack.Screen name="doctor/index" options={{ title: t('doctors.title') }} />
        <Stack.Screen name="doctor/emergency" options={{ title: t('emergencyScreen.title') }} />
        <Stack.Screen name="doctor/results" options={{ title: t('doctors.results') }} />
        <Stack.Screen name="book/[placeId]" options={{ title: t('booking.title') }} />
        <Stack.Screen name="book/doctor/[doctorId]" options={{ title: t('booking.title') }} />
        <Stack.Screen name="clinic-admin/index" options={{ title: t('clinic.dashboard') }} />
        <Stack.Screen name="clinic-admin/apply" options={{ title: t('clinic.applyTitle') }} />
        <Stack.Screen name="responder/index" options={{ title: t('responder.title') }} />
        <Stack.Screen name="responder/onboarding" options={{ title: t('responder.applyTitle') }} />
        <Stack.Screen name="responder/guide" options={{ title: t('guide.title') }} />
        <Stack.Screen name="sos/new" options={{ title: t('sos.title'), gestureEnabled: false }} />
        <Stack.Screen name="sos/[id]" options={{ title: t('sos.title'), gestureEnabled: false }} />
        <Stack.Screen name="responder/incoming/[id]" options={{ title: t('sos.incoming.title') }} />
        <Stack.Screen
          name="responder/active/[id]"
          options={{ title: t('sos.active.title'), gestureEnabled: false }}
        />
        <Stack.Screen name="l/[token]" options={{ title: t('sos.share.title') }} />
        <Stack.Screen name="privacy" options={{ title: t('privacy.title') }} />
      </Stack>
    </AuthProvider>
  );
}
