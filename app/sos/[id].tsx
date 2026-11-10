import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmergencyCallButtons } from '@/components/EmergencyCallButtons';
import { formatDistance } from '@/features/places/format';
import {
  ACTIVE_STATUSES,
  cancelSos,
  closeSos,
  getSosStatus,
  rateSos,
  type SosView,
  updateSosDetails,
} from '@/features/sos/api';
import { progressMessage } from '@/features/sos/progress';
import { colors, spacing } from '@/lib/theme';

const POLL_MS = 3000;

/** The live SOS screen for the person who raised it. 108 / 112 are always visible. */
export default function SosScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sos, setSos] = useState<SosView | null>(null);
  const [offline, setOffline] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [details, setDetails] = useState(false);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [rated, setRated] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    getSosStatus(id)
      .then((s) => {
        if (!active) return;
        setSos(s);
        setOffline(false);
      })
      .catch(() => active && setOffline(true));
    const timer = setTimeout(() => setTick((n) => n + 1), POLL_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, tick]);

  const msg = sos ? progressMessage(sos) : { key: 'sos.progress.starting' };
  const isActive = sos ? ACTIVE_STATUSES.includes(sos.status) : true;
  const ended =
    sos && ['closed', 'cancelled', 'no_responder', 'reached_hospital'].includes(sos.status);
  const r = sos?.responder;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <EmergencyCallButtons />

      <Text
        style={[styles.message, sos?.status === 'no_responder' && styles.urgent]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        testID="sos-progress"
      >
        {t(msg.key, msg.params ?? {})}
      </Text>
      {offline ? <Text style={styles.urgent}>{t('sos.errors.network')}</Text> : null}

      {r ? (
        <View style={styles.card} testID="responder-card">
          <Text style={styles.cardTitle}>
            {t('sos.responderCard', {
              name: r.name,
              vehicle: t(`responder.${r.vehicle_type}`),
              number: r.vehicle_number,
            })}
          </Text>
          {r.distance_m !== null ? (
            <Text style={styles.text}>
              {t('sos.distanceAway', { distance: formatDistance(r.distance_m) })}
            </Text>
          ) : null}
          <Text style={styles.note}>{t('sos.maskedCallNote')}</Text>
        </View>
      ) : null}

      {sos?.hospital ? (
        <View style={styles.card}>
          <Text style={styles.text}>{t('sos.hospital', { name: sos.hospital.name })}</Text>
          {sos.hospital.phone ? (
            <Button
              variant="secondary"
              label={t('sos.callHospital')}
              onPress={() => void Linking.openURL(`tel:${sos.hospital?.phone}`)}
            />
          ) : null}
        </View>
      ) : null}

      {isActive ? (
        <>
          {details ? (
            <View style={styles.card}>
              <TextInput
                accessibilityLabel={t('sos.note')}
                placeholder={t('sos.note')}
                value={note}
                onChangeText={setNote}
                maxLength={500}
                style={styles.input}
                multiline
              />
              <Button
                label={t('sos.saveDetails')}
                onPress={async () =>
                  setSaved(
                    await updateSosDetails(id, {
                      injuredCount: null,
                      isConscious: null,
                      canSit: null,
                      note,
                    }),
                  )
                }
              />
              {saved ? <Text style={styles.ok}>{t('sos.detailsSaved')}</Text> : null}
            </View>
          ) : (
            <Button
              variant="secondary"
              label={t('sos.addDetails')}
              onPress={() => setDetails(true)}
            />
          )}
          {sos && sos.status !== 'searching' ? (
            <Button
              variant="secondary"
              label={t('sos.imSafe')}
              onPress={async () => {
                await closeSos(id);
                setTick((n) => n + 1);
              }}
            />
          ) : null}
          {confirmCancel ? (
            <View style={styles.card}>
              <Text style={styles.text}>{t('sos.cancelConfirm')}</Text>
              <Button
                variant="danger"
                label={t('sos.cancelSos')}
                onPress={async () => {
                  await cancelSos(id, null);
                  setConfirmCancel(false);
                  setTick((n) => n + 1);
                }}
                testID="confirm-cancel-sos"
              />
              <Button
                variant="secondary"
                label={t('sos.keep')}
                onPress={() => setConfirmCancel(false)}
              />
            </View>
          ) : (
            <Button
              variant="danger"
              label={t('sos.cancelSos')}
              onPress={() => setConfirmCancel(true)}
              testID="cancel-sos"
            />
          )}
        </>
      ) : null}

      {ended && sos?.status !== 'cancelled' && !rated ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('sos.rate')}</Text>
          <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityLabel={String(n)}
                onPress={() => setStars(n)}
                style={styles.star}
              >
                <Text style={[styles.starText, n <= stars && styles.starOn]}>★</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel={t('appointments.reviewComment')}
            placeholder={t('appointments.reviewComment')}
            value={comment}
            onChangeText={setComment}
            maxLength={500}
            style={styles.input}
          />
          <View style={styles.row}>
            <Chip
              label={t('sos.report')}
              selected={false}
              onPress={async () => setRated(await rateSos(id, stars || 1, comment, true))}
            />
          </View>
          <Button
            label={t('sos.sendRating')}
            disabled={stars < 1}
            onPress={async () => setRated(await rateSos(id, stars, comment, false))}
          />
        </View>
      ) : null}
      {rated ? <Text style={styles.ok}>{t('sos.thanks')}</Text> : null}
      {ended ? (
        <Button variant="secondary" label={t('tabs.home')} onPress={() => router.dismissTo('/')} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  message: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: colors.text },
  urgent: { fontSize: 20, lineHeight: 28, fontWeight: '800', color: colors.sos },
  card: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface, gap: spacing.sm },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  text: { fontSize: 17, color: colors.text },
  note: { fontSize: 14, color: colors.textMuted },
  ok: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  input: {
    minHeight: 48,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    fontSize: 16,
    backgroundColor: colors.background,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  star: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  starText: { fontSize: 32, color: colors.border },
  starOn: { color: '#E3A008' },
});
