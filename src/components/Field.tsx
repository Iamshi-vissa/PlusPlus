import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { colors, spacing } from '@/lib/theme';

type Props = TextInputProps & { label: string; error?: string | null; prefix?: string };

/** A labelled text input with an inline error, sized for easy tapping. */
export function Field({ label, error, prefix, style, ...input }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, error ? styles.boxError : null]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style]}
          {...input}
        />
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  boxError: { borderColor: colors.sos },
  prefix: { fontSize: 18, color: colors.textMuted, marginRight: spacing.sm },
  input: { flex: 1, fontSize: 18, color: colors.text, paddingVertical: spacing.sm },
  error: { fontSize: 15, color: colors.sos },
});
