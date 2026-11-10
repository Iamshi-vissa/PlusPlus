import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { sendOtp, verifyOtp } from '@/features/auth/api';
import {
  formatIndianMobile,
  isValidOtp,
  normalizeIndianMobile,
  OTP_LENGTH,
} from '@/features/auth/phone';
import { colors, spacing } from '@/lib/theme';

const RESEND_AFTER_S = 60;

export default function VerifyScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = normalizeIndianMobile(params.phone ?? '');

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_AFTER_S);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  useEffect(() => {
    if (!phone) router.replace('/sign-in');
  }, [phone]);
  if (!phone) return null;

  const submit = async () => {
    if (!isValidOtp(code)) {
      setError(t('auth.codeInvalid'));
      return;
    }
    setError(null);
    setBusy(true);
    const result = await verifyOtp(phone, code.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.detail ? `${t(result.error)}\n(${result.detail})` : t(result.error));
      return;
    }
    router.dismissTo('/profile');
  };

  const resend = async () => {
    setError(null);
    setNotice(null);
    const result = await sendOtp(phone);
    if (result.ok) {
      setNotice(t('auth.resent'));
      setWait(RESEND_AFTER_S);
    } else {
      setError(result.detail ? `${t(result.error)}\n(${result.detail})` : t(result.error));
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.intro}>
        {t('auth.verifyIntro', { phone: formatIndianMobile(phone) })}
      </Text>
      <Field
        label={t('auth.codeLabel')}
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={OTP_LENGTH}
        error={error}
        onSubmitEditing={submit}
        style={styles.code}
        testID="code-input"
      />
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Button
        label={busy ? t('auth.verifying') : t('auth.verify')}
        onPress={submit}
        loading={busy}
        testID="verify"
      />
      <Button
        variant="secondary"
        label={wait > 0 ? t('auth.resendIn', { seconds: wait }) : t('auth.resend')}
        onPress={resend}
        disabled={wait > 0}
        testID="resend"
      />
      <Button variant="secondary" label={t('auth.changeNumber')} onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  intro: { fontSize: 17, lineHeight: 25, color: colors.text },
  code: { fontSize: 24, letterSpacing: 8 },
  notice: { fontSize: 15, color: colors.primary },
});
