import { Link, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { sendOtp } from '@/features/auth/api';
import { normalizeIndianMobile } from '@/features/auth/phone';
import { colors, spacing } from '@/lib/theme';

export default function SignInScreen() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const phone = normalizeIndianMobile(input);
    if (!phone) {
      setError(t('auth.phoneInvalid'));
      return;
    }
    setError(null);
    setSending(true);
    const result = await sendOtp(phone);
    setSending(false);
    if (!result.ok) {
      setError(result.detail ? `${t(result.error)}\n(${result.detail})` : t(result.error));
      return;
    }
    router.push({ pathname: '/verify', params: { phone } });
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.intro}>{t('auth.signInIntro')}</Text>
      <Field
        label={t('auth.phoneLabel')}
        prefix="+91"
        value={input}
        onChangeText={setInput}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={16}
        error={error}
        onSubmitEditing={submit}
        testID="phone-input"
      />
      <Button
        label={sending ? t('auth.sending') : t('auth.sendCode')}
        onPress={submit}
        loading={sending}
        testID="send-code"
      />
      <Link href="/privacy" style={styles.consent}>
        {t('privacy.consent')}
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.lg },
  intro: { fontSize: 17, lineHeight: 25, color: colors.text },
  consent: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
