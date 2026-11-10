import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { type Doctor, listDoctorsAtPlace } from '@/features/doctors/api';
import { colors, spacing } from '@/lib/theme';

/** "Book appointment" from a place: pick one of its doctors. */
export default function ChooseDoctorScreen() {
  const { t } = useTranslation();
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    listDoctorsAtPlace(placeId)
      .then(setDoctors)
      .catch(() => setError(true));
  }, [placeId]);

  const visible = (doctors ?? []).filter((d) => d.is_active && d.verified_at);
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.h1} accessibilityRole="header">
        {t('booking.chooseDoctor')}
      </Text>
      {error ? <Text style={styles.muted}>{t('places.errors.loadFailed')}</Text> : null}
      {doctors && visible.length === 0 ? (
        <Text style={styles.muted}>{t('booking.noDoctors')}</Text>
      ) : null}
      {visible.map((d) => (
        <Pressable
          key={d.id}
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/book/doctor/[doctorId]', params: { doctorId: d.id } })
          }
          style={styles.card}
          testID="doctor-row"
        >
          <Text style={styles.name}>{d.name}</Text>
          <Text style={styles.muted}>
            {d.qualifications} · {t('doctors.years', { count: d.years_experience })} ·{' '}
            {t('doctors.fee', { fee: d.fee })}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, gap: spacing.md },
  h1: { fontSize: 22, fontWeight: '700', color: colors.text },
  card: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface, gap: 4 },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  muted: { fontSize: 15, color: colors.textMuted },
});
