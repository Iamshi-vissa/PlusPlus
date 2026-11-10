import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { getPlace, type PlaceDetails } from '@/features/places/api';
import { DAY_KEYS, directionsUrl, formatDayHours, todayKey } from '@/features/places/format';
import { Badge, placeName } from '@/features/places/PlaceCard';
import { ReportPlace } from '@/features/places/ReportPlace';
import { colors, spacing } from '@/lib/theme';

export default function PlaceDetailsScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [place, setPlace] = useState<PlaceDetails | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    getPlace(id)
      .then((p) => active && setPlace(p))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [id]);

  if (error) return <Text style={[styles.text, styles.pad]}>{t('places.errors.loadFailed')}</Text>;
  if (place === undefined) return null;
  if (place === null)
    return <Text style={[styles.text, styles.pad]}>{t('places.details.notFound')}</Text>;

  const kn = i18n.language === 'kn';
  const today = todayKey();
  const area = [
    kn && place.taluk?.name_kn ? place.taluk.name_kn : place.taluk?.name_en,
    kn ? place.district?.name_kn : place.district?.name_en,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: t(`places.type.${place.type}`) }} />
      <Text style={styles.title} accessibilityRole="header">
        {placeName(place, i18n.language)}
      </Text>
      <View style={styles.badges}>
        <Badge label={t(`places.type.${place.type}`)} />
        {place.has_emergency ? <Badge label={t('places.badge.emergency')} strong /> : null}
        {place.trauma_care ? <Badge label={t('places.badge.trauma')} strong /> : null}
        {place.ownership ? <Badge label={t(`places.badge.${place.ownership}`)} /> : null}
        {place.source === 'demo' ? <Badge label={t('places.badge.sample')} /> : null}
      </View>

      <View style={styles.actions}>
        {place.phone ? (
          <Button
            label={`${t('places.call')} ${place.phone}`}
            onPress={() => void Linking.openURL(`tel:${place.phone}`)}
          />
        ) : null}
        <Button
          variant="secondary"
          label={t('places.directions')}
          onPress={() => void Linking.openURL(directionsUrl(place.lat, place.lng))}
        />
        {place.is_registered ? (
          <Button
            label={t('places.book')}
            onPress={() =>
              router.push({ pathname: '/book/[placeId]', params: { placeId: place.id } })
            }
            testID="book"
          />
        ) : null}
      </View>

      {place.address || area ? (
        <Section title={t('places.details.address')}>
          {uniqueParts([place.address, area, place.pincode]).join(', ')}
        </Section>
      ) : null}

      <Text style={styles.sectionTitle}>{t('places.details.hours')}</Text>
      {place.is_24x7 ? (
        <Text style={styles.text}>{t('places.status.open247')}</Text>
      ) : place.opening_hours ? (
        DAY_KEYS.map((day) => (
          <View key={day} style={styles.hoursRow}>
            <Text style={[styles.text, day === today && styles.bold]}>
              {t(`places.days.${day}`)}
            </Text>
            <Text style={[styles.text, day === today && styles.bold]}>
              {formatDayHours(place.opening_hours, day) ?? t('places.details.closedDay')}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.text}>{t('places.status.unknown')}</Text>
      )}

      {place.specialities.length > 0 ? (
        <Section title={t('places.details.specialities')}>{place.specialities.join(', ')}</Section>
      ) : null}

      <Text style={styles.note}>{t('places.details.checkFirst')}</Text>
      <ReportPlace placeId={place.id} />
    </ScrollView>
  );
}

/** PURE: drop empty and repeated parts ("Mysuru, Mysuru" → "Mysuru"). */
export function uniqueParts(parts: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts.flatMap((p) => (p ? p.split(',').map((x) => x.trim()) : []))) {
    if (part && !seen.has(part.toLowerCase())) {
      seen.add(part.toLowerCase());
      out.push(part);
    }
  }
  return out;
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  pad: { padding: spacing.lg },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: { gap: spacing.sm },
  section: { gap: spacing.xs },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  text: { fontSize: 16, lineHeight: 24, color: colors.text },
  bold: { fontWeight: '700' },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between' },
  note: { fontSize: 14, color: colors.textMuted, marginTop: spacing.md },
});
