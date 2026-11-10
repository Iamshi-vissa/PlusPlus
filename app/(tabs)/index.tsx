import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { EmergencyCallButtons } from '@/components/EmergencyCallButtons';
import { AreaCard } from '@/features/location/AreaCard';
import { colors, spacing } from '@/lib/theme';

export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.tagline}>{t('app.tagline')}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('home.sos')}, ${t('home.sosHint')}`}
        onPress={() => router.push('/sos/new')}
        testID="sos-button"
        style={({ pressed }) => [styles.sos, pressed && styles.sosPressed]}
      >
        <Text style={styles.sosLabel}>{t('home.sos')}</Text>
        <Text style={styles.sosHint}>{t('home.sosHint')}</Text>
      </Pressable>

      <EmergencyCallButtons />

      <Button
        label={t('home.findDoctor')}
        onPress={() => router.push('/doctor')}
        testID="find-doctor"
      />
      <Button
        variant="secondary"
        label={t('home.findCare')}
        onPress={() => router.push('/explore')}
      />

      <AreaCard />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.lg, alignItems: 'stretch' },
  tagline: { fontSize: 18, color: colors.textMuted, textAlign: 'center' },
  sos: {
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.sos,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  sosPressed: { backgroundColor: colors.sosPressed },
  sosLabel: { fontSize: 56, fontWeight: '800', color: colors.onSos },
  sosHint: {
    fontSize: 16,
    color: colors.onSos,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  notice: { fontSize: 16, lineHeight: 24, color: colors.text, textAlign: 'center' },
});
