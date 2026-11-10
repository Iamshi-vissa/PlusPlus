import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '@/lib/theme';

export function Chip(props: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: props.selected }}
      onPress={props.onPress}
      testID={props.testID}
      style={[styles.chip, props.selected && styles.selected]}
    >
      <Text style={[styles.label, props.selected && styles.labelSelected]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.primary },
  label: { fontSize: 15, color: colors.text },
  labelSelected: { color: colors.onSos, fontWeight: '700' },
});
