// Web / fallback: react-native-maps does not support the web.
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { colors, spacing } from '@/lib/theme';

import type { PlaceResult } from './types';

export const MAP_SUPPORTED = false;

export function PlacesMap(_props: {
  places: PlaceResult[];
  centre: { lat: number; lng: number } | null;
}) {
  const { t } = useTranslation();
  return <Text style={styles.note}>{t('places.mapWebOnly')}</Text>;
}

const styles = StyleSheet.create({
  note: { fontSize: 15, color: colors.textMuted, paddingVertical: spacing.sm },
});
