import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, Vibration } from 'react-native';

import { Button } from '@/components/Button';
import { EmergencyCallButtons } from '@/components/EmergencyCallButtons';
import { formatDistance } from '@/features/places/format';
import { acceptSos, type AlertView, declineSos, getAlert, markAlertSeen } from '@/features/sos/api';
import { etaMinutes, secondsLeft } from '@/features/sos/progress';
import { colors, spacing } from '@/lib/theme';

const ALARM = [0, 600, 300, 600, 300, 600];

export default function IncomingAlertScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [alert, setAlert] = useState<AlertView | null>(null);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<'accepted' | 'too_late' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void markAlertSeen(id);
    getAlert(id)
      .then(setAlert)
      .catch(() => undefined);
    Vibration.vibrate(ALARM, true);
    return () => Vibration.cancel();
  }, [id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const accept = async () => {
    setBusy(true);
    Vibration.cancel();
    const won = await acceptSos(id);
    setBusy(false);
    if (won) {
      setResult('accepted');
      router.replace({ pathname: '/responder/active/[id]', params: { id } });
    } else setResult('too_late');
  };
  const decline = async () => {
    Vibration.cancel();
    await declineSos(id);
    router.back();
  };

  const left = alert && now ? secondsLeft(alert.decide_by, now) : null;
  const conscious =
    alert?.is_conscious === true
      ? 'conscious'
      : alert?.is_conscious === false
        ? 'unconscious'
        : 'unknown';
  const needsLying = alert?.is_conscious === false || alert?.patient_can_sit === false;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="alert">
        {t('sos.incoming.title')}
      </Text>
      {alert ? (
        <>
          <Text style={styles.big} testID="alert-distance">
            {t('sos.incoming.distance', {
              distance: formatDistance(alert.distance_m),
              minutes: etaMinutes(alert.eta_s),
            })}
          </Text>
          {alert.injured_count ? (
            <Text style={styles.text}>
              {t('sos.incoming.injured', { count: alert.injured_count })}
            </Text>
          ) : null}
          <Text style={styles.text}>{t(`sos.incoming.${conscious}`)}</Text>
          {needsLying ? <Text style={styles.warn}>{t('sos.incoming.needsLying')}</Text> : null}
          {result === 'too_late' || (alert.status !== 'searching' && !alert.assigned_to_me) ? (
            <Text style={styles.ok}>{t('sos.incoming.tooLate')}</Text>
          ) : (
            <>
              {left !== null ? (
                <Text style={styles.timer}>{t('sos.incoming.decide', { seconds: left })}</Text>
              ) : null}
              <Button
                label={t('sos.incoming.accept')}
                onPress={accept}
                loading={busy}
                testID="accept-sos"
              />
              <Button
                variant="secondary"
                label={t('sos.incoming.decline')}
                onPress={decline}
                testID="decline-sos"
              />
            </>
          )}
        </>
      ) : null}
      <EmergencyCallButtons />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 28, fontWeight: '800', color: colors.sos },
  big: { fontSize: 22, fontWeight: '700', color: colors.text },
  text: { fontSize: 18, color: colors.text },
  warn: { fontSize: 17, fontWeight: '700', color: colors.sos },
  timer: { fontSize: 18, fontWeight: '700', color: colors.primary },
  ok: { fontSize: 18, fontWeight: '700', color: colors.primary },
});
