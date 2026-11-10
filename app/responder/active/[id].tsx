import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmergencyCallButtons } from '@/components/EmergencyCallButtons';
import { formatDistance } from '@/features/places/format';
import {
  type AlertView,
  getAlert,
  releaseSos,
  setSosStatus,
  type SosStatus,
} from '@/features/sos/api';
import { etaMinutes, navigationUrl } from '@/features/sos/progress';
import { setActiveSos } from '@/features/responder/tracking';
import { colors, spacing } from '@/lib/theme';

const NEXT: Partial<Record<SosStatus, { status: SosStatus; key: string }>> = {
  assigned: { status: 'en_route_to_scene', key: 'sos.active.onTheWay' },
  en_route_to_scene: { status: 'picked_up', key: 'sos.active.pickedUp' },
  picked_up: { status: 'reached_hospital', key: 'sos.active.reached' },
  reached_hospital: { status: 'closed', key: 'sos.active.done' },
};

export default function ActiveSosScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sos, setSos] = useState<AlertView | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setActiveSos(true); // share location every 5 s during the SOS
    return () => setActiveSos(false);
  }, []);
  useEffect(() => {
    getAlert(id)
      .then((a) => {
        setSos(a);
        setDestination((d) => d ?? a?.destination_place_id ?? null);
      })
      .catch(() => undefined);
  }, [id, reload]);

  const open = (lat: number, lng: number) =>
    void Linking.openURL(navigationUrl(lat, lng, Platform.OS));
  const advance = async (status: SosStatus) => {
    await setSosStatus(
      id,
      status,
      status === 'picked_up' || status === 'reached_hospital' ? destination : null,
    );
    if (status === 'closed') router.replace('/responder');
    else setReload((n) => n + 1);
  };

  if (!sos) return null;
  if (!sos.assigned_to_me)
    return <Text style={[styles.text, styles.pad]}>{t('sos.incoming.tooLate')}</Text>;
  const next = NEXT[sos.status];
  const toHospital = sos.status === 'picked_up' || sos.status === 'reached_hospital';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {sos.status === 'closed' ? <Text style={styles.ok}>{t('sos.active.finished')}</Text> : null}
      {sos.pickup && !toHospital ? (
        <View style={styles.card}>
          <Text style={styles.h2}>{t('sos.active.pickup')}</Text>
          {sos.pickup.raiser_name ? (
            <Text style={styles.text}>
              {t('sos.active.person', { name: sos.pickup.raiser_name })}
            </Text>
          ) : null}
          {sos.pickup.note ? (
            <Text style={styles.text}>{t('sos.active.note', { note: sos.pickup.note })}</Text>
          ) : null}
          <Button
            label={t('sos.active.navigate')}
            onPress={() => open(sos.pickup!.lat, sos.pickup!.lng)}
            testID="navigate-pickup"
          />
        </View>
      ) : null}

      {next ? (
        <Button label={t(next.key)} onPress={() => advance(next.status)} testID="advance-status" />
      ) : null}

      <Text style={styles.h2}>{t('sos.active.hospitals')}</Text>
      {(sos.hospitals ?? []).map((h) => (
        <View key={h.place_id} style={[styles.card, destination === h.place_id && styles.chosen]}>
          <Text style={styles.h3}>
            {i18n.language === 'kn' && h.name_kn ? h.name_kn : h.name_en}
          </Text>
          <Text style={styles.text}>
            {formatDistance(h.distance_m)} · {t('sos.active.eta', { minutes: etaMinutes(h.eta_s) })}
            {h.trauma_care ? ` · ${t('sos.active.trauma')}` : ''}
          </Text>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                variant={destination === h.place_id ? 'primary' : 'secondary'}
                label={t('sos.active.choose')}
                onPress={() => {
                  setDestination(h.place_id);
                  if (toHospital) open(h.lat, h.lng);
                }}
              />
            </View>
            {h.phone ? (
              <View style={styles.flex}>
                <Button
                  variant="secondary"
                  label={t('places.call')}
                  onPress={() => void Linking.openURL(`tel:${h.phone}`)}
                />
              </View>
            ) : null}
          </View>
          {toHospital ? (
            <Button
              variant="secondary"
              label={t('sos.active.navigate')}
              onPress={() => open(h.lat, h.lng)}
            />
          ) : null}
        </View>
      ))}

      <EmergencyCallButtons />

      {sos.status === 'assigned' || sos.status === 'en_route_to_scene' ? (
        confirmGiveUp ? (
          <View style={styles.card}>
            <Text style={styles.text}>{t('sos.active.giveUpConfirm')}</Text>
            <Button
              variant="danger"
              label={t('sos.active.giveUp')}
              onPress={async () => {
                await releaseSos(id);
                router.replace('/responder');
              }}
            />
            <Button
              variant="secondary"
              label={t('common.cancel')}
              onPress={() => setConfirmGiveUp(false)}
            />
          </View>
        ) : (
          <Button
            variant="danger"
            label={t('sos.active.giveUp')}
            onPress={() => setConfirmGiveUp(true)}
          />
        )
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  pad: { padding: spacing.lg },
  card: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface, gap: spacing.sm },
  chosen: { borderWidth: 2, borderColor: colors.primary },
  h2: { fontSize: 20, fontWeight: '700', color: colors.text },
  h3: { fontSize: 18, fontWeight: '700', color: colors.text },
  text: { fontSize: 17, color: colors.text },
  ok: { fontSize: 20, fontWeight: '700', color: colors.primary },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
