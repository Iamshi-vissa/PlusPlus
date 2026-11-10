import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { colors, spacing } from '@/lib/theme';

/** Shown on every screen when there is no internet. Phone calls (108 / 112) still work. */
export function OfflineBanner() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(false);
  useEffect(
    () =>
      NetInfo.addEventListener((s) =>
        setOffline(s.isConnected === false || s.isInternetReachable === false),
      ),
    [],
  );
  if (!offline) return null;
  return (
    <Text style={styles.banner} accessibilityRole="alert" testID="offline-banner">
      {t('offline.banner')}
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.text,
    color: colors.onSos,
    padding: spacing.sm,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
});
