import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/lib/theme';

import { directionsUrl, formatDistance } from './format';
import type { PlaceResult } from './types';

export function statusKey(p: Pick<PlaceResult, 'is_24x7' | 'open_now'>): string {
  if (p.is_24x7) return 'places.status.open247';
  if (p.open_now === true) return 'places.status.open';
  if (p.open_now === false) return 'places.status.closed';
  return 'places.status.unknown';
}

export function placeName(
  p: { name_en: string; name_kn: string | null },
  language: string,
): string {
  return language === 'kn' && p.name_kn ? p.name_kn : p.name_en;
}

export function PlaceCard({ place }: { place: PlaceResult }) {
  const { t, i18n } = useTranslation();
  const distance = formatDistance(place.distance_m);
  const open = place.is_24x7 || place.open_now === true;
  const area = [
    place.taluk_name_en,
    i18n.language === 'kn' ? place.district_name_kn : place.district_name_en,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.card} testID="place-card">
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/clinic/[id]', params: { id: place.id } })}
      >
        <Text style={styles.name}>{placeName(place, i18n.language)}</Text>
        <Text style={styles.meta}>
          {t(`places.type.${place.type}`)}
          {distance ? ` · ${t('places.away', { distance })}` : ''}
          {area ? ` · ${area}` : ''}
        </Text>
        <Text style={[styles.status, open ? styles.open : styles.closed]}>
          {t(statusKey(place))}
        </Text>
        <View style={styles.badges}>
          {place.has_emergency ? <Badge label={t('places.badge.emergency')} strong /> : null}
          {place.trauma_care ? <Badge label={t('places.badge.trauma')} strong /> : null}
          {place.ownership ? <Badge label={t(`places.badge.${place.ownership}`)} /> : null}
          {place.is_registered ? <Badge label={t('places.badge.registered')} /> : null}
        </View>
      </Pressable>
      <View style={styles.actions}>
        {place.phone ? (
          <Action
            label={t('places.call')}
            onPress={() => void Linking.openURL(`tel:${place.phone}`)}
          />
        ) : null}
        <Action
          label={t('places.directions')}
          onPress={() => void Linking.openURL(directionsUrl(place.lat, place.lng))}
        />
      </View>
    </View>
  );
}

export function Badge({ label, strong }: { label: string; strong?: boolean }) {
  return (
    <View style={[styles.badge, strong && styles.badgeStrong]}>
      <Text style={[styles.badgeText, strong && styles.badgeTextStrong]}>{label}</Text>
    </View>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface, gap: spacing.sm },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { fontSize: 15, color: colors.textMuted, marginTop: 2 },
  status: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  open: { color: colors.primary },
  closed: { color: colors.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.background,
  },
  badgeStrong: { backgroundColor: '#FDE8E8' },
  badgeText: { fontSize: 13, color: colors.text },
  badgeTextStrong: { color: colors.sos, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  actionText: { fontSize: 16, fontWeight: '700', color: colors.primary },
});
