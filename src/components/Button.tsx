import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '@/lib/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading, testID }: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onSos : colors.primary} />
      ) : null}
      <Text
        style={[
          styles.label,
          variant === 'primary' ? styles.labelOnPrimary : styles[`${variant}Label`],
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.background },
  danger: { borderWidth: 2, borderColor: colors.sos, backgroundColor: colors.background },
  pressed: { opacity: 0.8 },
  inactive: { opacity: 0.5 },
  label: { fontSize: 18, fontWeight: '700' },
  labelOnPrimary: { color: colors.onSos },
  secondaryLabel: { color: colors.primary },
  dangerLabel: { color: colors.sos },
});
