import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { rankDoctors, type RankedDoctor, type ReasonPart } from '@/dispatch/rankDoctors';
import {
  type DoctorFilters,
  findDoctors,
  type FoundDoctor,
  listSpecialities,
  type Speciality,
} from '@/features/doctors/api';
import { formatDateTime } from '@/features/doctors/format';
import { setDoctorSearch, useDoctorSearch } from '@/features/doctors/searchStore';
import { planSpecialities } from '@/features/doctors/specialityWeights';
import { formatDistance } from '@/features/places/format';
import { checkInKarnataka, type LatLng } from '@/lib/geo/karnataka';
import { getCurrentLocation } from '@/lib/location';
import { colors, spacing } from '@/lib/theme';

const DEFAULT_FILTERS: DoctorFilters = {
  radiusM: 10000,
  maxFee: null,
  gender: null,
  language: null,
  ownership: null,
  todayOnly: false,
};

export default function DoctorResultsScreen() {
  const { t, i18n } = useTranslation();
  const search = useDoctorSearch();
  const [where, setWhere] = useState<LatLng | null>(null);
  const [filters, setFilters] = useState<DoctorFilters>(DEFAULT_FILTERS);
  const [found, setFound] = useState<FoundDoctor[] | null>(null);
  const [message, setMessage] = useState<string | null>(t('doctors.locating'));
  const [specialities, setSpecialities] = useState<Speciality[]>([]);
  const kn = i18n.language === 'kn';

  const plan = useMemo(
    () => planSpecialities(search.choice, search.problems, search.answers, search.manualSpeciality),
    [search.choice, search.problems, search.answers, search.manualSpeciality],
  );
  const codes = useMemo(() => Object.keys(plan.weights), [plan]);

  useEffect(() => {
    listSpecialities()
      .then(setSpecialities)
      .catch(() => undefined);
    getCurrentLocation().then((loc) => {
      if (!loc.ok) return setMessage(t('doctors.locationNeeded'));
      if (checkInKarnataka(loc.coords) === 'outside') return setMessage(t('geo.outsideKarnataka'));
      setWhere(loc.coords);
    });
  }, [t]);

  useEffect(() => {
    if (!where) return;
    let active = true;
    findDoctors(where.lat, where.lng, codes, filters)
      .then((list) => {
        if (!active) return;
        setFound(list);
        setMessage(null);
      })
      .catch(() => active && setMessage(t('places.errors.searchFailed')));
    return () => {
      active = false;
    };
  }, [where, codes, filters, t]);

  const ranked = useMemo(
    () =>
      found
        ? rankDoctors(found, plan.weights, {
            radiusM: filters.radiusM,
            language: i18n.language,
            now: new Date(),
          })
        : [],
    [found, plan.weights, filters.radiusM, i18n.language],
  );

  const specialityName = (code: string) => {
    const s = specialities.find((x) => x.code === code);
    return s ? (kn ? s.name_kn : s.name_en) : code;
  };
  const reasonText = (r: ReasonPart) => {
    switch (r.kind) {
      case 'speciality':
        return specialityName(r.code);
      case 'slot':
        return r.days === 0
          ? t('doctors.why.slotToday')
          : r.days === 1
            ? t('doctors.why.slotTomorrow')
            : t('doctors.why.slotDays', { days: r.days });
      case 'distance':
        return formatDistance(r.meters) ?? '';
      case 'language':
        return t('doctors.why.speaks', { language: t(`doctors.languages.${r.language}`) });
      case 'rating':
        return t('doctors.why.rating', { value: r.value, count: r.count });
    }
  };
  const toggle = (patch: Partial<DoctorFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const switchType = (type: 'general' | 'specialist') =>
    setDoctorSearch({ choice: type, manualSpeciality: null });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.note}>{t('doctors.notDiagnosis')}</Text>
      {plan.suggested && plan.reasonKey ? (
        <Text style={styles.suggestion}>
          {t('doctors.suggestion', {
            type: t(`doctors.type.${plan.type}`),
            reason: t(plan.reasonKey),
          })}
        </Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label={t('doctors.type.general')}
          selected={search.choice === 'general'}
          onPress={() => switchType('general')}
          testID="switch-general"
        />
        <Chip
          label={t('doctors.type.specialist')}
          selected={search.choice === 'specialist'}
          onPress={() => switchType('specialist')}
          testID="switch-specialist"
        />
        <Chip
          label={t('doctors.filters.today')}
          selected={filters.todayOnly}
          onPress={() => toggle({ todayOnly: !filters.todayOnly })}
        />
        <Chip
          label={t('doctors.filters.fee', { fee: 500 })}
          selected={filters.maxFee === 500}
          onPress={() => toggle({ maxFee: filters.maxFee ? null : 500 })}
        />
        <Chip
          label={t('doctors.filters.female')}
          selected={filters.gender === 'female'}
          onPress={() => toggle({ gender: filters.gender === 'female' ? null : 'female' })}
        />
        <Chip
          label={t('doctors.filters.male')}
          selected={filters.gender === 'male'}
          onPress={() => toggle({ gender: filters.gender === 'male' ? null : 'male' })}
        />
        <Chip
          label={t('doctors.filters.language', {
            language: t(`doctors.languages.${i18n.language}`),
          })}
          selected={filters.language === i18n.language}
          onPress={() => toggle({ language: filters.language ? null : i18n.language })}
        />
        <Chip
          label={t('doctors.filters.government')}
          selected={filters.ownership === 'government'}
          onPress={() =>
            toggle({ ownership: filters.ownership === 'government' ? null : 'government' })
          }
        />
        <Chip
          label={t('doctors.filters.private')}
          selected={filters.ownership === 'private'}
          onPress={() => toggle({ ownership: filters.ownership === 'private' ? null : 'private' })}
        />
        <Chip
          label={t('doctors.filters.wider')}
          selected={filters.radiusM > 10000}
          onPress={() => toggle({ radiusM: filters.radiusM > 10000 ? 10000 : 30000 })}
        />
      </ScrollView>

      {message ? (
        <Text style={styles.message} accessibilityRole="alert">
          {message}
        </Text>
      ) : null}
      {found ? (
        <Text style={styles.count} testID="doctor-count">
          {t('doctors.resultsCount', { count: ranked.length })}
        </Text>
      ) : null}
      {found && ranked.length === 0 ? (
        <Text style={styles.message}>{t('doctors.noDoctors')}</Text>
      ) : null}

      {ranked.map((d) => (
        <DoctorCard
          key={d.doctor_id}
          doctor={d}
          why={d.reasons.map(reasonText).filter(Boolean).join(' · ')}
        />
      ))}
    </ScrollView>
  );
}

function DoctorCard({ doctor, why }: { doctor: RankedDoctor<FoundDoctor>; why: string }) {
  const { t, i18n } = useTranslation();
  const open = () =>
    router.push({ pathname: '/book/doctor/[doctorId]', params: { doctorId: doctor.doctor_id } });
  return (
    <View style={styles.card} testID="doctor-card">
      {doctor.bestMatch ? <Text style={styles.best}>{t('doctors.bestMatch')}</Text> : null}
      <Pressable accessibilityRole="button" onPress={open}>
        <Text style={styles.name}>{doctor.name}</Text>
        <Text style={styles.meta}>
          {doctor.qualifications} · {t('doctors.years', { count: doctor.years_experience })}
        </Text>
        <Text style={styles.meta}>
          {doctor.place_name} · {t('doctors.fee', { fee: doctor.fee })}
        </Text>
        <Text style={styles.why} testID="doctor-why">
          {why}
        </Text>
        <Text style={styles.slot}>
          {t('doctors.nextSlot', { time: formatDateTime(doctor.next_slot_at, i18n.language) })}
        </Text>
      </Pressable>
      <Button label={t('doctors.book')} onPress={open} testID="book-doctor" />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  chips: { gap: spacing.sm, paddingRight: spacing.md },
  note: { fontSize: 15, color: colors.textMuted, fontStyle: 'italic' },
  suggestion: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  message: { fontSize: 16, lineHeight: 24, color: colors.textMuted },
  count: { fontSize: 16, fontWeight: '700', color: colors.text },
  card: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface, gap: spacing.sm },
  best: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    color: colors.onSos,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { fontSize: 15, color: colors.textMuted },
  why: { fontSize: 15, color: colors.text, marginTop: 4 },
  slot: { fontSize: 15, fontWeight: '600', color: colors.primary, marginTop: 2 },
});
