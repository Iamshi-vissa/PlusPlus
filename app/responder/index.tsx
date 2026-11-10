import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { getMyResponder, type Responder, setAvailable } from '@/features/responder/api';
import { startTracking, stopTracking, type TrackingMode } from '@/features/responder/tracking';
import { colors, spacing } from '@/lib/theme';

export default function ResponderHomeScreen() {
  const { t } = useTranslation();
  const [r, setR] = useState<Responder | null | undefined>(undefined);
  const [mode, setMode] = useState<TrackingMode>('off');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getMyResponder()
      .then(async (me) => {
        setR(me);
        // keep sharing if they were available when the app was closed
        if (me?.is_available)
          setMode(
            await startTracking({ title: t('responder.available'), body: t('responder.sharing') }),
          );
      })
      .catch(() => setError(t('responder.errors.failed')));
  }, [t]);
  useFocusEffect(useCallback(() => load(), [load]));

  if (r === undefined) return null;
  if (r === null) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.text}>{t('responder.intro')}</Text>
        <Button
          label={t('responder.become')}
          onPress={() => router.push('/responder/onboarding')}
          testID="become-responder"
        />
      </ScrollView>
    );
  }

  const toggle = async () => {
    setBusy(true);
    setError(null);
    const next = !r.is_available;
    const err = await setAvailable(next);
    if (err) {
      setBusy(false);
      return setError(t(`responder.errors.${err}`, { defaultValue: t('responder.errors.failed') }));
    }
    if (next)
      setMode(
        await startTracking({ title: t('responder.available'), body: t('responder.sharing') }),
      );
    else {
      await stopTracking();
      setMode('off');
    }
    setR({ ...r, is_available: next });
    setBusy(false);
  };

  const verified = r.verification_status === 'verified';
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.label}>
        {r.vehicle_number} · {t(`responder.${r.vehicle_type}`)}
      </Text>
      <Text style={[styles.status, verified ? styles.ok : styles.muted]} testID="responder-status">
        {t(`responder.status.${r.verification_status}`)}
        {r.reviewer_note ? ` — ${r.reviewer_note}` : ''}
      </Text>
      {r.verification_status === 'rejected' ? (
        <Button
          variant="secondary"
          label={t('responder.reapply')}
          onPress={() => router.push('/responder/onboarding')}
        />
      ) : null}

      <Button
        variant={r.guide_completed_at ? 'secondary' : 'primary'}
        label={r.guide_completed_at ? t('responder.guideDone') : t('responder.readGuide')}
        onPress={() => router.push('/responder/guide')}
        testID="read-guide"
      />

      {verified ? (
        <>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: r.is_available, busy }}
            onPress={toggle}
            disabled={busy}
            style={[styles.toggle, r.is_available ? styles.toggleOn : styles.toggleOff]}
            testID="availability"
          >
            <Text style={styles.toggleTitle}>
              {r.is_available ? t('responder.available') : t('responder.unavailable')}
            </Text>
            <Text style={styles.toggleAction}>
              {r.is_available ? t('responder.goUnavailable') : t('responder.goAvailable')}
            </Text>
          </Pressable>
          <Text style={styles.muted}>{t('responder.availableHint')}</Text>
          {r.is_available ? (
            <Text style={mode === 'off' ? styles.error : styles.ok}>
              {mode === 'off' ? t('responder.notSharing') : t('responder.sharing')}
            </Text>
          ) : null}
          {r.is_available && mode === 'foreground' ? (
            <Text style={styles.muted}>{t('responder.backgroundNote')}</Text>
          ) : null}
        </>
      ) : null}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>{t('responder.stats')}</Text>
        <Text style={styles.text}>
          {t('responder.alertsReceived', { count: r.alerts_received })}
        </Text>
        <Text style={styles.text}>
          {t('responder.alertsAccepted', { count: r.alerts_accepted })}
        </Text>
        <Text style={styles.text}>{t('responder.helped', { count: r.helped_count })}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  label: { fontSize: 18, fontWeight: '700', color: colors.text },
  text: { fontSize: 16, lineHeight: 24, color: colors.text },
  muted: { fontSize: 15, lineHeight: 22, color: colors.textMuted },
  status: { fontSize: 16, fontWeight: '600' },
  ok: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  error: { fontSize: 16, color: colors.sos },
  toggle: {
    minHeight: 120,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: 4,
  },
  toggleOn: { backgroundColor: colors.primary },
  toggleOff: { backgroundColor: colors.textMuted },
  toggleTitle: { fontSize: 24, fontWeight: '800', color: colors.onSos },
  toggleAction: { fontSize: 16, color: colors.onSos },
  card: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface, gap: 4 },
});
