import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { getCurrentLocation } from '@/lib/location';
import { colors, spacing } from '@/lib/theme';

import { type Area, describeArea, localName } from './area';

type State =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'done'; area: Area }
  | { kind: 'error'; reason: 'denied' | 'unavailable' };

/** "Your area": shows the user's taluk and district, or that plusplus only works in Karnataka. */
export function AreaCard() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<State>({ kind: 'idle' });

  const locate = async () => {
    setState({ kind: 'locating' });
    const location = await getCurrentLocation();
    if (!location.ok) {
      setState({ kind: 'error', reason: location.reason });
      return;
    }
    setState({ kind: 'done', area: await describeArea(location.coords) });
  };

  const area = state.kind === 'done' ? state.area : null;
  let message: string | null = null;
  if (area?.status === 'outside') {
    message = t('geo.outsideKarnataka');
  } else if (area?.status === 'inside') {
    message =
      area.district && area.taluk
        ? t('home.area.inside', {
            taluk: localName(area.taluk, i18n.language),
            district: localName(area.district, i18n.language),
          })
        : t('home.area.insideUnknown');
  } else if (state.kind === 'error') {
    message = t(state.reason === 'denied' ? 'home.area.denied' : 'home.area.unavailable');
  }
  const outside = area?.status === 'outside';

  return (
    <View style={styles.card} testID="area-card">
      <Text style={styles.title} accessibilityRole="header">
        {t('home.area.title')}
      </Text>
      {message ? (
        <Text style={[styles.message, outside && styles.outside]} testID="area-message">
          {message}
        </Text>
      ) : null}
      <Button
        variant="secondary"
        label={
          state.kind === 'locating'
            ? t('home.area.locating')
            : state.kind === 'done'
              ? t('home.area.update')
              : t('home.area.use')
        }
        onPress={locate}
        loading={state.kind === 'locating'}
        testID="use-location"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface, gap: spacing.sm },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  message: { fontSize: 17, lineHeight: 24, color: colors.text },
  outside: { color: colors.sos },
});
