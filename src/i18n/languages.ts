export const SUPPORTED_LANGUAGES = ['en', 'kn'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: AppLanguage = 'en';

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * PURE: choose the app language.
 * A language the user saved wins; otherwise the first supported device language; otherwise English.
 */
export function pickLanguage(
  saved: string | null | undefined,
  deviceLanguages: readonly (string | null | undefined)[],
): AppLanguage {
  if (isAppLanguage(saved)) return saved;
  for (const code of deviceLanguages) {
    if (isAppLanguage(code)) return code;
  }
  return DEFAULT_LANGUAGE;
}
