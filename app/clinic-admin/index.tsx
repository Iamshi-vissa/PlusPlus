import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Field } from '@/components/Field';
import {
  addDoctor,
  type ClinicBooking,
  clinicBookings,
  createWeekdaySlots,
  isTime,
  markAppointment,
  type MyClinic,
  myClinics,
} from '@/features/clinic/api';
import {
  cancelAppointment,
  type Doctor,
  listDoctorsAtPlace,
  listSpecialities,
  type Speciality,
} from '@/features/doctors/api';
import { formatDateTime } from '@/features/doctors/format';
import { colors, spacing } from '@/lib/theme';

const LANGS = ['kn', 'en', 'hi', 'te', 'ta', 'ml', 'mr', 'ur', 'tu', 'kok'];

export default function ClinicDashboardScreen() {
  const { t, i18n } = useTranslation();
  const [clinics, setClinics] = useState<MyClinic[] | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [tab, setTab] = useState<'bookings' | 'doctors'>('bookings');
  const [bookings, setBookings] = useState<ClinicBooking[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialities, setSpecialities] = useState<Speciality[]>([]);
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    myClinics()
      .then((c) => {
        setClinics(c);
        setPlaceId((p) => p ?? c[0]?.place_id ?? null);
      })
      .catch(() => setClinics([]));
    listSpecialities()
      .then(setSpecialities)
      .catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    if (!placeId) return;
    clinicBookings(placeId)
      .then((list) => {
        setNow(Date.now());
        setBookings(list);
      })
      .catch(() => undefined);
    listDoctorsAtPlace(placeId)
      .then(setDoctors)
      .catch(() => undefined);
  }, [placeId]);
  useFocusEffect(useCallback(() => load(), [load]));
  useEffect(() => load(), [reload, load]);

  if (clinics && clinics.length === 0)
    return <Text style={[styles.text, styles.pad]}>{t('clinic.register')}</Text>;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {clinics && clinics.length > 1 ? (
        <View style={styles.wrap}>
          {clinics.map((c) => (
            <Chip
              key={c.place_id}
              label={c.place?.name_en ?? ''}
              selected={c.place_id === placeId}
              onPress={() => setPlaceId(c.place_id)}
            />
          ))}
        </View>
      ) : null}
      <Text style={styles.h1}>{clinics?.find((c) => c.place_id === placeId)?.place?.name_en}</Text>
      <View style={styles.row}>
        <Chip
          label={t('clinic.bookings')}
          selected={tab === 'bookings'}
          onPress={() => setTab('bookings')}
        />
        <Chip
          label={t('clinic.doctors')}
          selected={tab === 'doctors'}
          onPress={() => setTab('doctors')}
          testID="tab-doctors"
        />
      </View>

      {tab === 'bookings' ? (
        <>
          {bookings.length === 0 ? (
            <Text style={styles.muted}>{t('clinic.noBookings')}</Text>
          ) : null}
          {bookings.map((b) => {
            const started = new Date(b.starts_at).getTime() <= now;
            const open = ['pending', 'confirmed'].includes(b.status);
            return (
              <View key={b.id} style={styles.card} testID="clinic-booking">
                <Text style={styles.when}>
                  {formatDateTime(b.starts_at, i18n.language)} · {b.doctor_name}
                </Text>
                <Text style={styles.bold}>{b.patient_name ?? '—'}</Text>
                {b.patient_phone ? (
                  <Text
                    style={styles.link}
                    onPress={() => void Linking.openURL(`tel:${b.patient_phone}`)}
                  >
                    {b.patient_phone}
                  </Text>
                ) : null}
                {b.problem_description ? (
                  <Text style={styles.text}>
                    {t('clinic.patientSays', { text: b.problem_description })}
                  </Text>
                ) : null}
                <Text style={styles.muted}>{t(`appointments.status.${b.status}`)}</Text>
                {open ? (
                  <View style={styles.row}>
                    {started ? (
                      <>
                        <View style={styles.flex}>
                          <Button
                            label={t('clinic.markCompleted')}
                            onPress={async () => {
                              await markAppointment(b.id, 'completed');
                              setReload((r) => r + 1);
                            }}
                          />
                        </View>
                        <View style={styles.flex}>
                          <Button
                            variant="secondary"
                            label={t('clinic.markNoShow')}
                            onPress={async () => {
                              await markAppointment(b.id, 'no_show');
                              setReload((r) => r + 1);
                            }}
                          />
                        </View>
                      </>
                    ) : (
                      <View style={styles.flex}>
                        <Button
                          variant="danger"
                          label={t('clinic.cancelBooking')}
                          onPress={async () => {
                            await cancelAppointment(b.id);
                            setReload((r) => r + 1);
                          }}
                        />
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}

      {tab === 'doctors' && placeId ? (
        <>
          {doctors.map((d) => (
            <DoctorRow key={d.id} doctor={d} />
          ))}
          <AddDoctor
            placeId={placeId}
            specialities={specialities}
            onAdded={() => setReload((r) => r + 1)}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

function DoctorRow({ doctor }: { doctor: Doctor }) {
  const { t } = useTranslation();
  const [from, setFrom] = useState('09:30');
  const [to, setTo] = useState('13:00');
  const [minutes, setMinutes] = useState('15');
  const [message, setMessage] = useState<string | null>(null);
  const create = async () => {
    if (!isTime(from) || !isTime(to) || from >= to) return setMessage(t('clinic.errors2.time'));
    const n = await createWeekdaySlots(doctor.id, from, to, Number(minutes) || 15);
    setMessage(
      n === null ? t('appointments.errors.failed') : t('clinic.slotsCreated', { count: n }),
    );
  };
  return (
    <View style={styles.card}>
      <Text style={styles.bold}>{doctor.name}</Text>
      <Text style={styles.muted}>
        {doctor.specialities.join(', ')} · ₹{doctor.fee} ·{' '}
        {doctor.verified_at ? t('clinic.verified') : t('clinic.unverified')}
      </Text>
      <Text style={styles.bold}>{t('clinic.timetable')}</Text>
      <Text style={styles.muted}>{t('clinic.timetableHint')}</Text>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Field label={t('clinic.from')} value={from} onChangeText={setFrom} maxLength={5} />
        </View>
        <View style={styles.flex}>
          <Field label={t('clinic.to')} value={to} onChangeText={setTo} maxLength={5} />
        </View>
      </View>
      <Field
        label={t('clinic.slotMinutes')}
        value={minutes}
        onChangeText={setMinutes}
        keyboardType="number-pad"
        maxLength={3}
      />
      {message ? <Text style={styles.info}>{message}</Text> : null}
      <Button variant="secondary" label={t('clinic.createSlots')} onPress={create} />
    </View>
  );
}

function AddDoctor({
  placeId,
  specialities,
  onAdded,
}: {
  placeId: string;
  specialities: Speciality[];
  onAdded: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'female' | 'male' | 'other' | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [qualifications, setQualifications] = useState('');
  const [years, setYears] = useState('');
  const [fee, setFee] = useState('');
  const [nmc, setNmc] = useState('');
  const [langs, setLangs] = useState<string[]>(['kn', 'en']);
  const [error, setError] = useState<string | null>(null);
  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const save = async () => {
    const feeN = Number(fee);
    if (
      !name.trim() ||
      !qualifications.trim() ||
      codes.length === 0 ||
      !Number.isFinite(feeN) ||
      fee === ''
    ) {
      return setError(t('clinic.errors2.doctor'));
    }
    const ok = await addDoctor({
      placeId,
      name,
      gender,
      specialities: codes.slice(0, 5),
      qualifications,
      yearsExperience: Math.min(70, Number(years) || 0),
      languages: langs,
      fee: feeN,
      nmcRegistrationNo: nmc,
    });
    if (!ok) return setError(t('appointments.errors.failed'));
    setError(null);
    setName('');
    setCodes([]);
    setQualifications('');
    setYears('');
    setFee('');
    setNmc('');
    onAdded();
  };

  return (
    <View style={styles.card}>
      <Text style={styles.h2}>{t('clinic.addDoctor')}</Text>
      <Field label={t('clinic.doctorName')} value={name} onChangeText={setName} maxLength={120} />
      <Text style={styles.bold}>{t('clinic.gender')}</Text>
      <View style={styles.wrap}>
        {(['female', 'male', 'other'] as const).map((g) => (
          <Chip
            key={g}
            label={t(`clinic.genders.${g}`)}
            selected={gender === g}
            onPress={() => setGender(g)}
          />
        ))}
      </View>
      <Text style={styles.bold}>{t('clinic.specialities')}</Text>
      <View style={styles.wrap}>
        {specialities.map((s) => (
          <Chip
            key={s.code}
            label={i18n.language === 'kn' ? s.name_kn : s.name_en}
            selected={codes.includes(s.code)}
            onPress={() => setCodes((c) => toggle(c, s.code))}
          />
        ))}
      </View>
      <Field
        label={t('clinic.qualifications')}
        value={qualifications}
        onChangeText={setQualifications}
        maxLength={200}
      />
      <Field
        label={t('clinic.experience')}
        value={years}
        onChangeText={setYears}
        keyboardType="number-pad"
        maxLength={2}
      />
      <Field
        label={t('clinic.fee')}
        value={fee}
        onChangeText={setFee}
        keyboardType="number-pad"
        maxLength={6}
      />
      <Field label={t('clinic.nmc')} value={nmc} onChangeText={setNmc} maxLength={40} />
      <Text style={styles.bold}>{t('clinic.languagesSpoken')}</Text>
      <View style={styles.wrap}>
        {LANGS.map((l) => (
          <Chip
            key={l}
            label={t(`doctors.languages.${l}`)}
            selected={langs.includes(l)}
            onPress={() => setLangs((x) => toggle(x, l))}
          />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={t('clinic.saveDoctor')} onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  pad: { padding: spacing.lg },
  h1: { fontSize: 22, fontWeight: '700', color: colors.text },
  h2: { fontSize: 18, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { flex: 1 },
  card: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface, gap: spacing.sm },
  when: { fontSize: 16, fontWeight: '700', color: colors.primary },
  bold: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 16, lineHeight: 23, color: colors.text },
  muted: { fontSize: 15, color: colors.textMuted },
  link: { fontSize: 16, color: colors.primary, textDecorationLine: 'underline' },
  info: { fontSize: 15, color: colors.primary },
  error: { fontSize: 15, color: colors.sos },
});
