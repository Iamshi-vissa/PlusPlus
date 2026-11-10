import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '@/lib/theme';

import { Button } from './Button';
import { EmergencyCallButtons } from './EmergencyCallButtons';

/**
 * Shown if a screen crashes. Even then, 108 / 112 stay one tap away.
 * Crash reporting: send the error to Sentry (or similar) here once a DSN is configured;
 * never include phone numbers, names, medical details or locations.
 */
export function CrashScreen({ retry }: { error: Error; retry: () => Promise<void> }) {
  const { t } = useTranslation();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('crash.title')}</Text>
      <Text style={styles.body}>{t('crash.body')}</Text>
      <EmergencyCallButtons />
      <Button label={t('crash.retry')} onPress={() => void retry()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  body: { fontSize: 17, lineHeight: 25, color: colors.text },
});
