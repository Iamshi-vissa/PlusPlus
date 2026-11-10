import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { directionsUrl } from '@/features/places/format';
import { sharedLocation, type SosStatus } from '@/features/sos/api';
import { progressMessage } from '@/features/sos/progress';
import { colors, spacing } from '@/lib/theme';

/** The live-location link sent by SMS to emergency contacts. Works without the app or a login. */
export default function SharedLocationScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [data, setData] = useState<
    { status: SosStatus; lat: number; lng: number; hospital: string | null } | null | undefined
  >(undefined);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    sharedLocation(token)
      .then(setData)
      .catch(() => setData(null));
    const timer = setTimeout(() => setTick((n) => n + 1), 15000);
    return () => clearTimeout(timer);
  }, [token, tick]);

  if (data === undefined) return null;
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('sos.share.title')}</Text>
      {data ? (
        <>
          <Text style={styles.text}>
            {(() => {
              const m = progressMessage({
                status: data.status,
                alerted: 1,
                deciding: 0,
                radius_m: 2000,
                responder: null,
                hospital: data.hospital
                  ? { name: data.hospital, phone: null, lat: 0, lng: 0 }
                  : null,
              });
              return t(m.key, m.params ?? {});
            })()}
          </Text>
          <Button
            label={t('sos.share.open')}
            onPress={() => void Linking.openURL(directionsUrl(data.lat, data.lng))}
          />
        </>
      ) : (
        <Text style={styles.text}>{t('sos.share.ended')}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  text: { fontSize: 18, lineHeight: 26, color: colors.text },
});
