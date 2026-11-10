import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { EmergencyCallButtons } from '@/components/EmergencyCallButtons';
import { colors, spacing } from '@/lib/theme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const [sosTapped, setSosTapped] = useState(false);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.tagline}>{t('app.tagline')}</Text>

      {/* The SOS flow itself is built in phase 7. Until then the button points people to 108 / 112. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('home.sos')}, ${t('home.sosHint')}`}
        onPress={() => setSosTapped(true)}
        testID="sos-button"
        style={({ pressed }) => [styles.sos, pressed && styles.sosPressed]}
      >
        <Text style={styles.sosLabel}>{t('home.sos')}</Text>
        <Text style={styles.sosHint}>{t('home.sosHint')}</Text>
      </Pressable>

      {sosTapped ? (
        <Text style={styles.notice} accessibilityRole="alert">
          {t('home.sosComingSoon')}
        </Text>
      ) : null}

      <EmergencyCallButtons />
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
