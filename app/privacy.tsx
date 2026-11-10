import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { deleteMyAccount, exportMyData } from '@/features/privacy/api';
import { colors, spacing } from '@/lib/theme';

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const download = async () => {
    const json = await exportMyData();
    if (!json) return setMessage(t('privacy.errors.failed'));
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = 'plusplus-my-data.json';
      a.click();
    } else {
      await Share.share({ message: json, title: 'plusplus-my-data.json' });
    }
    setMessage(t('privacy.downloadReady'));
  };
  const remove = async () => {
    const err = await deleteMyAccount();
    setConfirm(false);
    setMessage(err ? t(`privacy.errors.${err}`) : t('privacy.deleted'));
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.text}>{t('privacy.intro')}</Text>
      <Text style={styles.h2}>{t('privacy.what')}</Text>
      {['1', '2', '3', '4', '5'].map((k) => (
        <Text key={k} style={styles.item}>
          • {t(`privacy.items.${k}`)}
        </Text>
      ))}
      <Text style={styles.text}>{t('privacy.retention')}</Text>
      <Text style={styles.text}>{t('privacy.never')}</Text>
      {session ? (
        <>
          <Button
            variant="secondary"
            label={t('privacy.download')}
            onPress={download}
            testID="download-data"
          />
          {confirm ? (
            <View style={styles.box}>
              <Text style={styles.text}>{t('privacy.deleteConfirm')}</Text>
              <Button
                variant="danger"
                label={t('privacy.deleteYes')}
                onPress={remove}
                testID="confirm-delete"
              />
              <Button
                variant="secondary"
                label={t('common.cancel')}
                onPress={() => setConfirm(false)}
              />
            </View>
          ) : (
            <Button
              variant="danger"
              label={t('privacy.delete')}
              onPress={() => setConfirm(true)}
              testID="delete-account"
            />
          )}
        </>
      ) : null}
      {message ? (
        <Text style={styles.message} accessibilityRole="alert">
          {message}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  h2: { fontSize: 19, fontWeight: '700', color: colors.text },
  text: { fontSize: 16, lineHeight: 24, color: colors.text },
  item: { fontSize: 16, lineHeight: 24, color: colors.text, paddingLeft: spacing.sm },
  box: { gap: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: '#FDE8E8' },
  message: { fontSize: 16, fontWeight: '600', color: colors.primary },
});
