import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { completeGuide } from '@/features/responder/api';
import { colors, spacing } from '@/lib/theme';

const SECTIONS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'] as const;

/** Responders must read this before going available. */
export default function FirstAidGuideScreen() {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  const confirm = async () => {
    if (await completeGuide()) setDone(true);
    else setError(true);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.intro}>{t('guide.intro')}</Text>
      {SECTIONS.map((s) => (
        <View key={s} style={[styles.section, s === 's2' && styles.warn]}>
          <Text style={styles.h2}>{t(`guide.${s}t`)}</Text>
          <Text style={styles.text}>{t(`guide.${s}`)}</Text>
        </View>
      ))}
      <View style={[styles.section, styles.law]}>
        <Text style={styles.h2}>{t('guide.lawt')}</Text>
        <Text style={styles.text}>{t('guide.law')}</Text>
        <Text style={styles.note}>{t('guide.lawNote')}</Text>
      </View>
      {done ? (
        <>
          <Text style={styles.ok} accessibilityRole="alert">
            {t('guide.done')}
          </Text>
          <Button label={t('responder.mode')} onPress={() => router.replace('/responder')} />
        </>
      ) : (
        <Button label={t('guide.confirm')} onPress={confirm} testID="guide-confirm" />
      )}
      {error ? <Text style={styles.error}>{t('responder.errors.failed')}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  intro: { fontSize: 17, lineHeight: 25, color: colors.text, fontWeight: '600' },
  section: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  warn: { backgroundColor: '#FDE8E8' },
  law: { backgroundColor: '#E6F4EE' },
  h2: { fontSize: 18, fontWeight: '700', color: colors.text },
  text: { fontSize: 17, lineHeight: 26, color: colors.text },
  note: { fontSize: 14, color: colors.textMuted },
  ok: { fontSize: 18, fontWeight: '700', color: colors.primary },
  error: { fontSize: 16, color: colors.sos },
});
