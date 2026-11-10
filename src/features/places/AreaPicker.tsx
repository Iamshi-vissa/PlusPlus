import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors, spacing } from '@/lib/theme';

import { type District, listDistricts, listTaluks, type Taluk } from './api';
import type { Where } from './types';

/** District → taluk picker. Returns a taluk, or a whole district. */
export function AreaPicker(props: {
  visible: boolean;
  onClose: () => void;
  onPick: (where: Where) => void;
}) {
  const { t, i18n } = useTranslation();
  const [districts, setDistricts] = useState<District[] | null>(null);
  const [district, setDistrict] = useState<District | null>(null);
  const [taluks, setTaluks] = useState<Taluk[] | null>(null);
  const [error, setError] = useState(false);
  const kn = i18n.language === 'kn';

  useEffect(() => {
    if (!props.visible || districts) return;
    listDistricts()
      .then(setDistricts)
      .catch(() => setError(true));
  }, [props.visible, districts]);

  useEffect(() => {
    if (!district) return;
    let active = true;
    listTaluks(district.id)
      .then((list) => active && setTaluks(list))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [district]);

  const districtName = (d: District) => (kn ? d.name_kn : d.name_en);

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          {district
            ? t('places.area.taluk', { district: districtName(district) })
            : t('places.area.district')}
        </Text>
        {error ? <Text style={styles.error}>{t('places.errors.searchFailed')}</Text> : null}
        {district ? (
          <FlatList
            data={taluks ?? []}
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={
              <Row
                label={t('places.area.wholeDistrict', { district: districtName(district) })}
                onPress={() =>
                  props.onPick({
                    kind: 'district',
                    districtId: district.id,
                    label: districtName(district),
                  })
                }
                strong
              />
            }
            renderItem={({ item }) => (
              <Row
                label={kn && item.name_kn ? item.name_kn : item.name_en}
                onPress={() =>
                  props.onPick({
                    kind: 'taluk',
                    talukId: item.id,
                    label: `${kn && item.name_kn ? item.name_kn : item.name_en}, ${districtName(district)}`,
                  })
                }
              />
            )}
          />
        ) : (
          <FlatList
            data={districts ?? []}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Row
                label={districtName(item)}
                onPress={() => {
                  setTaluks(null);
                  setDistrict(item);
                }}
                testID={`district-${item.id}`}
              />
            )}
          />
        )}
        <View style={styles.footer}>
          {district ? (
            <Button
              variant="secondary"
              label={t('places.area.back')}
              onPress={() => setDistrict(null)}
            />
          ) : null}
          <Button variant="secondary" label={t('places.area.close')} onPress={props.onClose} />
        </View>
      </View>
    </Modal>
  );
}

function Row(props: { label: string; onPress: () => void; strong?: boolean; testID?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={styles.row}
      testID={props.testID}
    >
      <Text style={[styles.rowText, props.strong && styles.rowStrong]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  row: {
    minHeight: 52,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { fontSize: 18, color: colors.text },
  rowStrong: { fontWeight: '700', color: colors.primary },
  error: { fontSize: 16, color: colors.sos },
  footer: { gap: spacing.sm, paddingTop: spacing.md },
});
