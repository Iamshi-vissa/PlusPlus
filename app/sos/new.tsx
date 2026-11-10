import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View, Vibration } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmergencyCallButtons } from '@/components/EmergencyCallButtons';
import { useAuth } from '@/features/auth/AuthProvider';
import { type CreateError, createSos } from '@/features/sos/api';
import { getCurrentLocation, type LocationResult } from '@/lib/location';
import { colors, spacing } from '@/lib/theme';

const COUNTDOWN_S = 5;

/**
 * SOS: 5-second countdown with Cancel (stops accidental taps). 108 / 112 are always on screen.
 * Location is fetched during the countdown so sending is instant.
 */
export default function NewSosScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [left, setLeft] = useState(COUNTDOWN_S);
  const [phase, setPhase] = useState<'countdown' | 'sending' | 'error'>('countdown');
  const [error, setError] = useState<CreateError | 'location' | null>(null);
  const [conscious, setConscious] = useState<boolean | null>(null);
  const [canSit, setCanSit] = useState<boolean | null>(null);
  const [injured, setInjured] = useState<number | null>(null);
  const location = useRef<Promise<LocationResult> | null>(null);
  const sent = useRef(false);

  useEffect(() => {
    location.current = getCurrentLocation();
    Vibration.vibrate(200);
  }, []);

  const send = async () => {
    if (sent.current) return;
    sent.current = true;
    setPhase('sending');
    if (!session) {
      setError('not_signed_in');
      return setPhase('error');
    }
    const loc = await (location.current ?? getCurrentLocation());
    if (!loc.ok) {
      setError('location');
      return setPhase('error');
    }
    const result = await createSos(loc.coords.lat, loc.coords.lng, loc.accuracyM, {
      injuredCount: injured,
      isConscious: conscious,
      canSit,
      note: '',
    });
    if (!result.ok) {
      setError(result.error);
      return setPhase('error');
    }
    router.replace({ pathname: '/sos/[id]', params: { id: result.id } });
  };

  useEffect(() => {
    if (phase !== 'countdown') return;
    const timer = setTimeout(() => {
      if (left <= 1) void send();
      else setLeft((x) => x - 1);
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase]);

  const tri = (value: boolean | null, set: (v: boolean | null) => void, id: string) => (
    <View style={styles.row}>
      <Chip
        label={t('sos.yes')}
        selected={value === true}
        onPress={() => set(true)}
        testID={`${id}-yes`}
      />
      <Chip
        label={t('sos.no')}
        selected={value === false}
        onPress={() => set(false)}
        testID={`${id}-no`}
      />
      <Chip label={t('sos.notSure')} selected={value === null} onPress={() => set(null)} />
    </View>
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <EmergencyCallButtons />

      {phase === 'countdown' ? (
        <>
          <Text
            style={styles.big}
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            testID="countdown"
          >
            {t('sos.countdownTitle', { seconds: left })}
          </Text>
          <Text style={styles.hint}>{t('sos.countdownHint')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.cancel}
            testID="sos-cancel"
          >
            <Text style={styles.cancelText}>{t('sos.cancel')}</Text>
          </Pressable>
          <Button
            variant="danger"
            label={t('sos.sendNow')}
            onPress={() => void send()}
            testID="sos-send-now"
          />

          <Text style={styles.label}>{t('sos.quickTitle')}</Text>
          <Text style={styles.q}>{t('sos.conscious')}</Text>
          {tri(conscious, setConscious, 'conscious')}
          <Text style={styles.q}>{t('sos.canSit')}</Text>
          {tri(canSit, setCanSit, 'can-sit')}
          <Text style={styles.q}>{t('sos.injured')}</Text>
          <View style={styles.row}>
            {[1, 2, 3, 4].map((n) => (
              <Chip
                key={n}
                label={n === 4 ? '4+' : String(n)}
                selected={injured === n}
                onPress={() => setInjured(n)}
              />
            ))}
          </View>
        </>
      ) : null}

      {phase === 'sending' ? (
        <Text style={styles.big} accessibilityLiveRegion="polite">
          {t('sos.sending')}
        </Text>
      ) : null}

      {phase === 'error' && error ? (
        <>
          <Text style={styles.error} accessibilityRole="alert" testID="sos-error">
            {t(`sos.errors.${error}`)}
          </Text>
          {error === 'not_signed_in' || error === 'phone_not_verified' ? (
            <Button label={t('sos.signIn')} onPress={() => router.push('/sign-in')} />
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  big: { fontSize: 26, fontWeight: '800', color: colors.sos, textAlign: 'center' },
  hint: { fontSize: 17, color: colors.text, textAlign: 'center' },
  cancel: {
    minHeight: 72,
    borderRadius: 16,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 24, fontWeight: '800', color: colors.onSos },
  label: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  q: { fontSize: 17, color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: colors.sos },
});
