import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  cancelAppointment,
  type MyAppointment,
  myAppointments,
  submitReview,
} from '@/features/doctors/api';
import { canChangeOnline, formatDateTime } from '@/features/doctors/format';
import { colors, spacing } from '@/lib/theme';

export default function AppointmentsScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [list, setList] = useState<MyAppointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const load = useCallback(() => {
    myAppointments()
      .then((l) => {
        setNow(Date.now());
        setList(l);
        setError(null);
      })
      .catch(() => setError(t('places.errors.searchFailed')));
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      if (session) load();
    }, [session, load]),
  );

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>{t('appointments.signInFirst')}</Text>
        <Button label={t('profile.signIn')} onPress={() => router.push('/sign-in')} />
      </View>
    );
  }

  const upcoming = (list ?? [])
    .filter(
      (a) =>
        ['pending', 'confirmed'].includes(a.status) &&
        new Date(a.starts_at).getTime() > now - 3600000,
    )
    .reverse();
  const past = (list ?? []).filter((a) => !upcoming.includes(a));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {list && list.length === 0 ? (
        <>
          <Text style={styles.muted}>{t('appointments.empty')}</Text>
          <Button label={t('appointments.findDoctor')} onPress={() => router.push('/doctor')} />
        </>
      ) : null}
      {upcoming.length > 0 ? <Text style={styles.h2}>{t('appointments.upcoming')}</Text> : null}
      {upcoming.map((a) => (
        <AppointmentCard key={a.id} appt={a} onChange={load} />
      ))}
      {past.length > 0 ? <Text style={styles.h2}>{t('appointments.past')}</Text> : null}
      {past.map((a) => (
        <AppointmentCard key={a.id} appt={a} onChange={load} />
      ))}
    </ScrollView>
  );
}

function AppointmentCard({ appt, onChange }: { appt: MyAppointment; onChange: () => void }) {
  const { t, i18n } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const open = ['pending', 'confirmed'].includes(appt.status);
  const changeable =
    open && canChangeOnline(appt.starts_at, appt.place?.cancel_cutoff_minutes ?? 120);

  const cancel = async () => {
    setConfirming(false);
    const r = await cancelAppointment(appt.id);
    if (!r.ok)
      setMessage(
        t(
          r.error === 'past_cutoff'
            ? 'appointments.errors.past_cutoff'
            : 'appointments.errors.failed',
        ),
      );
    else onChange();
  };
  const review = async () => {
    if (stars < 1) return;
    if (await submitReview(appt.id, stars, comment)) {
      setReviewing(false);
      setMessage(t('appointments.reviewed'));
      onChange();
    } else setMessage(t('appointments.errors.failed'));
  };

  return (
    <View style={styles.card} testID="appointment-card">
      <Text style={styles.when}>{formatDateTime(appt.starts_at, i18n.language)}</Text>
      <Text style={styles.name}>{appt.doctor?.name}</Text>
      <Text style={styles.muted}>{appt.place?.name_en}</Text>
      <Text style={[styles.status, appt.status === 'confirmed' && styles.ok]}>
        {t(`appointments.status.${appt.status}`)}
      </Text>
      {appt.problem_description ? (
        <Text style={styles.muted}>“{appt.problem_description}”</Text>
      ) : null}
      {message ? <Text style={styles.info}>{message}</Text> : null}

      {open && appt.place?.phone ? (
        <Button
          variant="secondary"
          label={t('appointments.call')}
          onPress={() => void Linking.openURL(`tel:${appt.place?.phone}`)}
        />
      ) : null}
      {changeable && !confirming ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button
              variant="secondary"
              label={t('appointments.reschedule')}
              onPress={() =>
                router.push({
                  pathname: '/book/doctor/[doctorId]',
                  params: { doctorId: appt.doctor?.id ?? '', reschedule: appt.id },
                })
              }
            />
          </View>
          <View style={styles.flex}>
            <Button
              variant="danger"
              label={t('appointments.cancel')}
              onPress={() => setConfirming(true)}
              testID="cancel-appointment"
            />
          </View>
        </View>
      ) : null}
      {open && !changeable ? (
        <Text style={styles.note}>{t('appointments.errors.past_cutoff')}</Text>
      ) : null}
      {confirming ? (
        <View style={styles.box}>
          <Text style={styles.text}>{t('appointments.cancelConfirm')}</Text>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                variant="secondary"
                label={t('appointments.keep')}
                onPress={() => setConfirming(false)}
              />
            </View>
            <View style={styles.flex}>
              <Button
                variant="danger"
                label={t('appointments.cancel')}
                onPress={cancel}
                testID="confirm-cancel"
              />
            </View>
          </View>
        </View>
      ) : null}

      {appt.status === 'completed' && !appt.reviewed && !reviewing ? (
        <Button
          variant="secondary"
          label={t('appointments.review')}
          onPress={() => setReviewing(true)}
        />
      ) : null}
      {reviewing ? (
        <View style={styles.box}>
          <Text style={styles.text}>
            {t('appointments.reviewTitle', { doctor: appt.doctor?.name })}
          </Text>
          <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityLabel={`${n}`}
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
          <Button label={t('appointments.submitReview')} onPress={review} disabled={stars < 1} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: {
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  h2: { fontSize: 20, fontWeight: '700', color: colors.text },
  card: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface, gap: spacing.xs },
  when: { fontSize: 17, fontWeight: '700', color: colors.primary },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  muted: { fontSize: 15, color: colors.textMuted },
  status: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  ok: { color: colors.primary },
  text: { fontSize: 16, color: colors.text },
  info: { fontSize: 15, color: colors.primary },
  note: { fontSize: 14, color: colors.textMuted },
  error: { fontSize: 16, color: colors.sos },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  box: { gap: spacing.sm, paddingTop: spacing.sm },
  star: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  starText: { fontSize: 32, color: colors.border },
  starOn: { color: '#E3A008' },
  input: {
    minHeight: 48,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    fontSize: 16,
    backgroundColor: colors.background,
  },
});
