import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { EmergencyCallButtons } from '@/components/EmergencyCallButtons';
import { colors, spacing } from '@/lib/theme';

/** Shown instead of doctor search when the answers suggest an emergency. 108/112 always visible. */
export default function EmergencyScreen() {
  const { t } = useTranslation();
  const { reasons = '' } = useLocalSearchParams<{ reasons?: string }>();
  const selfHarm = reasons.split(',').includes('self_harm');

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {t('emergencyScreen.title')}
      </Text>
      <Text style={styles.body}>{t('emergencyScreen.body')}</Text>
      <EmergencyCallButtons />
      {selfHarm ? (
        <>
          <Text style={styles.body}>{t('emergencyScreen.selfHarm')}</Text>
          <Button
            label={t('emergencyScreen.callTeleManas')}
            onPress={() => void Linking.openURL('tel:14416')}
          />
        </>
      ) : null}
      <Button
        variant="danger"
        label={t('emergencyScreen.raiseSos')}
        onPress={() => router.push('/sos/new')}
        testID="raise-sos"
      />
      <Button
        variant="secondary"
        label={t('emergencyScreen.nearestHospital')}
        onPress={() => router.push({ pathname: '/explore', params: { emergency: '1' } })}
      />
      <Button
        variant="secondary"
        label={t('emergencyScreen.notEmergency')}
        onPress={() => router.back()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 26, fontWeight: '800', color: colors.sos },
  body: { fontSize: 18, lineHeight: 26, color: colors.text },
});
