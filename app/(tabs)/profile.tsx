import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { setAppLanguage } from '@/i18n';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { colors, spacing } from '@/lib/theme';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('profile.language')}
      </Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {SUPPORTED_LANGUAGES.map((language) => {
          const selected = i18n.language === language;
          return (
            <Pressable
              key={language}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => void setAppLanguage(language)}
              testID={`language-${language}`}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                {t(`language.${language}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.message}>{t('profile.comingSoon')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: spacing.md },
  option: {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.surface },
  optionLabel: { fontSize: 18, color: colors.text },
  optionLabelSelected: { fontWeight: '700', color: colors.primary },
  message: { fontSize: 16, lineHeight: 24, color: colors.textMuted },
});
