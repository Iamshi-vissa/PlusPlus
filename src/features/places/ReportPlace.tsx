import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { useAuth } from '@/features/auth/AuthProvider';
import { reportProblem } from '@/features/privacy/api';
import { colors, spacing } from '@/lib/theme';

const REASONS = ['wrong_info', 'fraud', 'other'] as const;

export function ReportPlace({ placeId }: { placeId: string }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>('wrong_info');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<'idle' | 'sent' | 'failed'>('idle');
  if (!session) return null;
  if (status === 'sent') return <Text style={styles.ok}>{t('report.sent')}</Text>;
  if (!open)
    return (
      <Button
        variant="secondary"
        label={t('report.wrongInfo')}
        onPress={() => setOpen(true)}
        testID="report-place"
      />
    );
  return (
    <View style={styles.box}>
      <Text style={styles.h3}>{t('report.title')}</Text>
      <View style={styles.wrap}>
        {REASONS.map((r) => (
          <Chip
            key={r}
            label={t(`report.reasons.${r}`)}
            selected={reason === r}
            onPress={() => setReason(r)}
          />
        ))}
      </View>
      <TextInput
        accessibilityLabel={t('report.details')}
        placeholder={t('report.details')}
        value={details}
        onChangeText={setDetails}
        maxLength={1000}
        multiline
        style={styles.input}
      />
      {status === 'failed' ? <Text style={styles.error}>{t('report.failed')}</Text> : null}
      <Button
        label={t('report.send')}
        onPress={async () =>
          setStatus((await reportProblem('place', placeId, reason, details)) ? 'sent' : 'failed')
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface },
  h3: { fontSize: 17, fontWeight: '700', color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: {
    minHeight: 60,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    fontSize: 16,
    backgroundColor: colors.background,
  },
  ok: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  error: { fontSize: 15, color: colors.sos },
});
