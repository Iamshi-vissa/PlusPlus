import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/lib/theme';

export function PlaceholderScreen(props: { title: string; message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {props.title}
      </Text>
      <Text style={styles.message}>{props.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  message: { fontSize: 16, lineHeight: 24, color: colors.textMuted },
});
