import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  bookAppointment,
  type Doctor,
  getDoctor,
  listOpenSlots,
  rescheduleAppointment,
  type Slot,
} from '@/features/doctors/api';
import {
  formatDateTime,
  formatDay,
  formatSlotTime,
  groupSlotsByDay,
  partOfDay,
} from '@/features/doctors/format';
import { getDoctorSearch } from '@/features/doctors/searchStore';
import { colors, spacing } from '@/lib/theme';

/** Pick a day and time with one doctor, then confirm. With ?reschedule=<id> it moves an appointment. */
export default function BookDoctorScreen() {
  const { t, i18n } = useTranslation();
  const { doctorId, reschedule } = useLocalSearchParams<{
    doctorId: string;
    reschedule?: string;
  }>();
  const { session } = useAuth();
  const search = getDoctorSearch();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [description, setDescription] = useState(search.description);
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    getDoctor(doctorId)
      .then(setDoctor)
      .catch(() => setError(t('places.errors.loadFailed')));
  }, [doctorId, t]);
  useEffect(() => {
    listOpenSlots(doctorId)
      .then((list) => {
        setSlots(list);
        setDay((d) => d ?? (list[0] ? groupSlotsByDay(list)[0].day : null));
      })
      .catch(() => setError(t('places.errors.loadFailed')));
  }, [doctorId, reload, t]);

  const days = useMemo(() => groupSlotsByDay(slots ?? []), [slots]);
  const daySlots = days.find((d) => d.day === day)?.slots ?? [];

  if (!session) {
    return (
      <View style={[styles.container, styles.fill]}>
        <Text style={styles.text}>{t('booking.signInFirst')}</Text>
        <Button label={t('booking.signIn')} onPress={() => router.push('/sign-in')} />
      </View>
    );
  }

  const confirm = async () => {
    if (!slot) return;
    setStatus('saving');
    setError(null);
    const result = reschedule
      ? await rescheduleAppointment(reschedule, slot.id)
      : await bookAppointment(slot.id, {
          problemCode: search.problems[0]?.code ?? null,
          description,
          choice: search.problems.length > 0 || description ? search.choice : null,
          answers: search.answers,
        });
    if (!result.ok) {
      setStatus('idle');
      setError(t(`booking.errors.${result.error === 'past_cutoff' ? 'failed' : result.error}`));
      if (result.error === 'slot_taken') {
        setSlot(null);
        setReload((r) => r + 1);
      }
      return;
    }
    setStatus('done');
  };

  if (status === 'done') {
    return (
      <View style={[styles.container, styles.fill]}>
        <Text style={styles.success} accessibilityRole="alert">
          {t('booking.booked')}
        </Text>
        <Button
          label={t('booking.toAppointments')}
          onPress={() => router.dismissTo('/appointments')}
          testID="to-appointments"
        />
      </View>
    );
  }

  const groups = (['morning', 'afternoon', 'evening'] as const)
    .map((part) => ({ part, list: daySlots.filter((s) => partOfDay(s.starts_at) === part) }))
    .filter((g) => g.list.length > 0);
  const cutoffHours = Math.round((doctor?.place?.cancel_cutoff_minutes ?? 120) / 60);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {doctor ? (
        <View>
          <Text style={styles.h1} accessibilityRole="header">
            {doctor.name}
          </Text>
          <Text style={styles.muted}>
            {doctor.qualifications} · {doctor.place?.name_en} ·{' '}
            {t('doctors.fee', { fee: doctor.fee })}
          </Text>
        </View>
      ) : null}
      {reschedule ? <Text style={styles.label}>{t('booking.rescheduleTitle')}</Text> : null}

      <Text style={styles.label}>{t('booking.chooseDay')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {days.map((d) => (
          <Chip
            key={d.day}
            label={formatDay(d.slots[0].starts_at, i18n.language)}
            selected={d.day === day}
            onPress={() => {
              setDay(d.day);
              setSlot(null);
            }}
          />
        ))}
      </ScrollView>
      {slots && days.length === 0 ? (
        <Text style={styles.muted}>{t('booking.noDoctors')}</Text>
      ) : null}

      <Text style={styles.label}>{t('booking.chooseTime')}</Text>
      {groups.length === 0 && slots ? (
        <Text style={styles.muted}>{t('booking.noSlots')}</Text>
      ) : null}
      {groups.map((g) => (
        <View key={g.part} style={styles.group}>
          <Text style={styles.muted}>{t(`booking.${g.part}`)}</Text>
          <View style={styles.wrap}>
            {g.list.map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: slot?.id === s.id }}
                onPress={() => setSlot(s)}
                style={[styles.time, slot?.id === s.id && styles.timeSelected]}
                testID="slot"
              >
                <Text style={[styles.timeText, slot?.id === s.id && styles.timeTextSelected]}>
                  {formatSlotTime(s.starts_at, i18n.language)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {slot ? (
        <View style={styles.confirmBox}>
          <Text style={styles.label}>{t('booking.confirmTitle')}</Text>
          <Text style={styles.text}>{formatDateTime(slot.starts_at, i18n.language)}</Text>
          {!reschedule ? (
            <>
              <Text style={styles.muted}>{t('booking.describeLabel')}</Text>
              <TextInput
                accessibilityLabel={t('booking.describeLabel')}
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={1000}
                style={styles.textArea}
                testID="booking-description"
              />
              <Text style={styles.note}>{t('booking.privacyNote')}</Text>
            </>
          ) : null}
          <Text style={styles.note}>{t('booking.payNote', { hours: cutoffHours })}</Text>
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button
            label={
              status === 'saving'
                ? t('booking.booking')
                : reschedule
                  ? t('booking.rescheduleConfirm')
                  : t('booking.confirm')
            }
            onPress={confirm}
            loading={status === 'saving'}
            testID="confirm-booking"
          />
        </View>
      ) : error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  fill: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
  h1: { fontSize: 22, fontWeight: '700', color: colors.text },
  label: { fontSize: 17, fontWeight: '700', color: colors.text },
  text: { fontSize: 17, color: colors.text },
  muted: { fontSize: 15, color: colors.textMuted },
  note: { fontSize: 14, color: colors.textMuted },
  error: { fontSize: 16, color: colors.sos },
  success: { fontSize: 20, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  chips: { gap: spacing.sm, paddingRight: spacing.md },
  group: { gap: spacing.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  time: {
    minWidth: 84,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  timeSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  timeText: { fontSize: 16, color: colors.text },
  timeTextSelected: { color: colors.onSos, fontWeight: '700' },
  confirmBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  textArea: {
    minHeight: 80,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
  },
});
