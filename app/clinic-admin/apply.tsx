import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Field } from '@/components/Field';
import { useAuth } from '@/features/auth/AuthProvider';
import { applyClinic, type ClinicApplication, myClinicApplications } from '@/features/clinic/api';
import { checkInKarnataka, type LatLng } from '@/lib/geo/karnataka';
import { getCurrentLocation } from '@/lib/location';
import { colors, spacing } from '@/lib/theme';
import { pickDocumentImage, type PickedImage, uploadPrivateDocument } from '@/lib/upload';

export default function ApplyClinicScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [apps, setApps] = useState<ClinicApplication[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<'clinic' | 'hospital'>('clinic');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [hfr, setHfr] = useState('');
  const [location, setLocation] = useState<LatLng | null>(null);
  const [doc, setDoc] = useState<PickedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (session)
      myClinicApplications()
        .then(setApps)
        .catch(() => undefined);
  }, [session, done]);

  if (!session) {
    return (
      <View style={styles.container}>
        <Button label={t('profile.signIn')} onPress={() => router.push('/sign-in')} />
      </View>
    );
  }

  const useHere = async () => {
    const loc = await getCurrentLocation();
    if (!loc.ok)
      return setError(t(loc.reason === 'denied' ? 'home.area.denied' : 'home.area.unavailable'));
    if (checkInKarnataka(loc.coords) === 'outside')
      return setError(t('clinic.errors.outside_karnataka'));
    setError(null);
    setLocation(loc.coords);
  };

  const submit = async () => {
    const digits = phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (!name.trim() || !address.trim() || !registrationNo.trim())
      return setError(t('clinic.errors.required'));
    if (!/^\d{10}$/.test(digits)) return setError(t('clinic.errors.phone'));
    if (!location) return setError(t('clinic.errors.location'));
    setSaving(true);
    setError(null);
    const documentPath = doc
      ? await uploadPrivateDocument('clinic-docs', session.user.id, 'registration', doc)
      : null;
    const result = await applyClinic({
      name,
      type,
      address,
      phone: `+91${digits}`,
      location,
      registrationNo,
      hfrFacilityId: hfr || null,
      documentPath,
    });
    setSaving(false);
    if (!result.ok) return setError(t(`clinic.errors.${result.error}`));
    setDone(true);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.text}>{t('clinic.applyIntro')}</Text>
      {apps.map((a) => (
        <View key={a.id} style={styles.status}>
          <Text style={styles.bold}>{a.name}</Text>
          <Text style={styles.text}>
            {t(`clinic.status.${a.status}`)}
            {a.reviewer_note ? ` — ${a.reviewer_note}` : ''}
          </Text>
        </View>
      ))}
      {done ? (
        <Text style={styles.success} accessibilityRole="alert">
          {t('clinic.submitted')}
        </Text>
      ) : null}
      {!done && !apps.some((a) => a.status === 'pending') ? (
        <>
          <Field
            label={t('clinic.name')}
            value={name}
            onChangeText={setName}
            maxLength={200}
            testID="clinic-name"
          />
          <Text style={styles.bold}>{t('clinic.type')}</Text>
          <View style={styles.row}>
            <Chip
              label={t('places.type.clinic')}
              selected={type === 'clinic'}
              onPress={() => setType('clinic')}
            />
            <Chip
              label={t('places.type.hospital')}
              selected={type === 'hospital'}
              onPress={() => setType('hospital')}
            />
          </View>
          <Field
            label={t('clinic.address')}
            value={address}
            onChangeText={setAddress}
            maxLength={500}
            multiline
            testID="clinic-address"
          />
          <Field
            label={t('clinic.phone')}
            prefix="+91"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={14}
            testID="clinic-phone"
          />
          <Field
            label={t('clinic.registration')}
            value={registrationNo}
            onChangeText={setRegistrationNo}
            maxLength={60}
            testID="clinic-registration"
          />
          <Field
            label={t('clinic.hfr')}
            value={hfr}
            onChangeText={setHfr}
            maxLength={12}
            autoCapitalize="characters"
          />
          <Text style={styles.bold}>{t('clinic.location')}</Text>
          <Button
            variant="secondary"
            label={location ? t('clinic.locationSet') : t('clinic.useLocation')}
            onPress={useHere}
            testID="clinic-location"
          />
          <Text style={styles.bold}>{t('clinic.document')}</Text>
          <Button
            variant="secondary"
            label={doc ? t('clinic.documentSet') : t('clinic.pickDocument')}
            onPress={async () => setDoc(await pickDocumentImage())}
          />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button
            label={t('clinic.submit')}
            onPress={submit}
            loading={saving}
            testID="clinic-submit"
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  text: { fontSize: 16, lineHeight: 24, color: colors.text },
  bold: { fontSize: 16, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: spacing.sm },
  status: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface, gap: 2 },
  error: { fontSize: 16, color: colors.sos },
  success: { fontSize: 18, fontWeight: '700', color: colors.primary },
});
