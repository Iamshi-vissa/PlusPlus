import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Field } from '@/components/Field';
import { useAuth } from '@/features/auth/AuthProvider';
import { applyAsResponder } from '@/features/responder/api';
import { isLicenceNumber, normalizeVehicleNumber } from '@/features/responder/locationRules';
import { colors, spacing } from '@/lib/theme';
import { pickDocumentImage, type PickedImage, uploadPrivateDocument } from '@/lib/upload';

const DOCS = ['licence', 'rc', 'vehiclePhoto', 'selfie'] as const;
type DocKind = (typeof DOCS)[number];

export default function ResponderOnboardingScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [vehicleType, setVehicleType] = useState<'three_wheeler' | 'four_wheeler'>('three_wheeler');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [licence, setLicence] = useState('');
  const [docs, setDocs] = useState<Partial<Record<DocKind, PickedImage>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!session) {
    return (
      <View style={styles.container}>
        <Button label={t('profile.signIn')} onPress={() => router.push('/sign-in')} />
      </View>
    );
  }

  const submit = async () => {
    const vehicle = normalizeVehicleNumber(vehicleNumber);
    if (!vehicle) return setError(t('responder.errors.vehicle'));
    if (!isLicenceNumber(licence)) return setError(t('responder.errors.licence'));
    if (DOCS.some((d) => !docs[d])) return setError(t('responder.errors.docs'));
    setBusy(true);
    setError(null);
    const paths: Partial<Record<DocKind, string>> = {};
    for (const d of DOCS) {
      const path = await uploadPrivateDocument('responder-docs', session.user.id, d, docs[d]!);
      if (!path) {
        setBusy(false);
        return setError(t('responder.errors.upload'));
      }
      paths[d] = path;
    }
    const err = await applyAsResponder({
      vehicleType,
      vehicleNumber: vehicle,
      licenceNumber: licence.replace(/[\s-]/g, ''),
      licencePath: paths.licence!,
      rcPath: paths.rc!,
      vehiclePhotoPath: paths.vehiclePhoto!,
      selfiePath: paths.selfie!,
    });
    setBusy(false);
    if (err) return setError(t(`responder.errors.${err === 'suspended' ? 'suspended' : 'failed'}`));
    router.replace('/responder/guide');
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.text}>{t('responder.intro')}</Text>
      <Text style={styles.label}>{t('responder.vehicleType')}</Text>
      <View style={styles.row}>
        <Chip
          label={t('responder.three_wheeler')}
          selected={vehicleType === 'three_wheeler'}
          onPress={() => setVehicleType('three_wheeler')}
        />
        <Chip
          label={t('responder.four_wheeler')}
          selected={vehicleType === 'four_wheeler'}
          onPress={() => setVehicleType('four_wheeler')}
        />
      </View>
      <Field
        label={t('responder.vehicleNumber')}
        value={vehicleNumber}
        onChangeText={setVehicleNumber}
        autoCapitalize="characters"
        maxLength={15}
        testID="vehicle-number"
      />
      <Field
        label={t('responder.licenceNumber')}
        value={licence}
        onChangeText={setLicence}
        autoCapitalize="characters"
        maxLength={20}
        testID="licence-number"
      />
      <Text style={styles.label}>{t('responder.docs')}</Text>
      {DOCS.map((d) => (
        <View key={d} style={styles.docRow}>
          <Text style={[styles.text, styles.flex]}>{t(`responder.${d}`)}</Text>
          <Button
            variant="secondary"
            label={docs[d] ? t('responder.added') : t('responder.add')}
            onPress={async () => {
              const img = await pickDocumentImage();
              if (img) setDocs((x) => ({ ...x, [d]: img }));
            }}
          />
        </View>
      ))}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button
        label={busy ? t('responder.uploading') : t('responder.submit')}
        onPress={submit}
        loading={busy}
        testID="responder-submit"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  label: { fontSize: 17, fontWeight: '700', color: colors.text },
  text: { fontSize: 16, lineHeight: 24, color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  error: { fontSize: 16, color: colors.sos },
});
