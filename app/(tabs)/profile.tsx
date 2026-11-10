import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatIndianMobile } from '@/features/auth/phone';
import { myClinics } from '@/features/clinic/api';
import { listContacts } from '@/features/contacts/api';
import { MAX_EMERGENCY_CONTACTS } from '@/features/contacts/rules';
import { getMyProfile, type Profile, updateMyProfile } from '@/features/profile/api';
import { setAppLanguage } from '@/i18n';
import { type AppLanguage, SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { colors, spacing } from '@/lib/theme';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { configured, session } = useAuth();

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <LanguagePicker profileId={session?.user.id ?? null} />
      {!configured ? <Text style={styles.message}>{t('profile.notConfigured')}</Text> : null}
      {configured && !session ? (
        <View style={styles.section}>
          <Text style={styles.message}>{t('profile.signedOutIntro')}</Text>
          <Button
            label={t('profile.signIn')}
            onPress={() => router.push('/sign-in')}
            testID="go-sign-in"
          />
        </View>
      ) : null}
      {session ? <SignedInProfile key={session.user.id} /> : null}
      <Button
        variant="secondary"
        label={t('privacy.link')}
        onPress={() => router.push('/privacy')}
        testID="privacy"
      />
    </ScrollView>
  );
}

function SignedInProfile() {
  const { t, i18n } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'loadError'>('idle');

  // Runs when the tab opens and whenever the user comes back to it (e.g. after editing contacts).
  const load = useCallback(async () => {
    try {
      const [loaded, contacts] = await Promise.all([getMyProfile(), listContacts()]);
      setProfile(loaded);
      setName(loaded?.full_name ?? '');
      setContactCount(contacts.length);
      // The language saved on the account follows the user to a new phone.
      if (loaded && loaded.language !== i18n.language) await setAppLanguage(loaded.language);
    } catch {
      setStatus('loadError');
    }
  }, [i18n]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (status === 'loadError')
    return <Text style={styles.error}>{t('profile.errors.loadFailed')}</Text>;
  if (!profile) return null;

  const save = async () => {
    setStatus('saving');
    const ok = await updateMyProfile(profile.id, { full_name: name.trim() || null });
    setStatus(ok ? 'saved' : 'error');
  };

  return (
    <View style={styles.section}>
      <Field
        label={t('profile.nameLabel')}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setStatus('idle');
        }}
        placeholder={t('profile.namePlaceholder')}
        autoComplete="name"
        maxLength={100}
        error={status === 'error' ? t('profile.errors.saveFailed') : null}
        testID="profile-name"
      />
      <Button
        variant="secondary"
        label={
          status === 'saving'
            ? t('common.saving')
            : status === 'saved'
              ? t('common.saved')
              : t('common.save')
        }
        onPress={save}
        loading={status === 'saving'}
        testID="save-profile"
      />

      <Text style={styles.label}>{t('profile.phoneLabel')}</Text>
      <Text style={styles.value}>{profile.phone ? formatIndianMobile(profile.phone) : '—'}</Text>

      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('profile.emergencyContacts')}
      </Text>
      {contactCount !== null ? (
        <Text style={styles.message}>
          {t('profile.contactsCount', { count: contactCount, max: MAX_EMERGENCY_CONTACTS })}
        </Text>
      ) : null}
      <Button
        label={t('profile.manageContacts')}
        onPress={() => router.push('/emergency-contacts')}
        testID="manage-contacts"
      />

      <Button
        variant="secondary"
        label={t('responder.mode')}
        onPress={() => router.push('/responder')}
        testID="responder-mode"
      />
      <ClinicLinks />

      <Button
        variant="danger"
        label={t('profile.signOut')}
        onPress={() => void signOut()}
        testID="sign-out"
      />
    </View>
  );
}

function ClinicLinks() {
  const { t } = useTranslation();
  const [isClinicAdmin, setIsClinicAdmin] = useState(false);
  useFocusEffect(
    useCallback(() => {
      myClinics()
        .then((c) => setIsClinicAdmin(c.length > 0))
        .catch(() => undefined);
    }, []),
  );
  return isClinicAdmin ? (
    <Button
      variant="secondary"
      label={t('clinic.manage')}
      onPress={() => router.push('/clinic-admin')}
      testID="manage-clinic"
    />
  ) : (
    <Button
      variant="secondary"
      label={t('clinic.register')}
      onPress={() => router.push('/clinic-admin/apply')}
      testID="register-clinic"
    />
  );
}

function LanguagePicker({ profileId }: { profileId: string | null }) {
  const { t, i18n } = useTranslation();

  const choose = async (language: AppLanguage) => {
    await setAppLanguage(language);
    if (profileId) await updateMyProfile(profileId, { language });
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('profile.language')}
      </Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {SUPPORTED_LANGUAGES.map((language) => {
          const selected = i18n.language === language;
          return (
            <Pressable
              key={language}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => void choose(language)}
              testID={`language-${language}`}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                {t(`language.${language}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: spacing.md },
  option: {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.surface },
  optionLabel: { fontSize: 18, color: colors.text },
  optionLabelSelected: { fontWeight: '700', color: colors.primary },
  message: { fontSize: 16, lineHeight: 24, color: colors.textMuted },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
  value: { fontSize: 18, color: colors.text },
  error: { fontSize: 16, color: colors.sos },
});
