import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { callEmergency, type EmergencyNumber } from '@/lib/emergency';
import { colors, spacing } from '@/lib/theme';

/**
 * One-tap 108 / 112 buttons. These must appear on every SOS screen and must never be
 * hidden or removed. They only need the phone dialler, so they work offline.
 */
export function EmergencyCallButtons() {
  const { t } = useTranslation();
  const [failedNumber, setFailedNumber] = useState<EmergencyNumber | null>(null);

  const call = async (number: EmergencyNumber) => {
    const ok = await callEmergency(number);
    setFailedNumber(ok ? null : number);
  };

  return (
    <View>
      <View style={styles.row}>
        <CallButton
          label={t('emergency.call108')}
          hint={t('emergency.call108Hint')}
          onPress={() => call('108')}
          testID="call-108"
        />
        <CallButton
          label={t('emergency.call112')}
          hint={t('emergency.call112Hint')}
          onPress={() => call('112')}
          testID="call-112"
        />
      </View>
      {failedNumber ? (
        <Text style={styles.error} accessibilityRole="alert">
          {t('emergency.callFailed', { number: failedNumber })}
        </Text>
      ) : null}
    </View>
  );
}

function CallButton(props: { label: string; hint: string; onPress: () => void; testID: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${props.label}, ${props.hint}`}
      onPress={props.onPress}
      testID={props.testID}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Text style={styles.label}>{props.label}</Text>
      <Text style={styles.hint}>{props.hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  button: {
    flex: 1,
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.sos,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  buttonPressed: { backgroundColor: colors.surface },
  label: { fontSize: 20, fontWeight: '700', color: colors.sos, textAlign: 'center' },
  hint: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  error: { marginTop: spacing.sm, fontSize: 16, color: colors.sos, textAlign: 'center' },
});
