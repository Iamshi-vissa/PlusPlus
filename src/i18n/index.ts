import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import kn from './kn.json';
import { type AppLanguage, DEFAULT_LANGUAGE, pickLanguage } from './languages';

const LANGUAGE_STORAGE_KEY = 'plusplus.language';

function deviceLanguages(): (string | null)[] {
  try {
    return getLocales().map((locale) => locale.languageCode);
  } catch {
    return [];
  }
}

// Start synchronously with the device language so the first screen never shows raw keys,
// then switch to the saved choice (if any) once storage has been read.
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, kn: { translation: kn } },
  lng: pickLanguage(null, deviceLanguages()),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
  .then((saved) => {
    const language = pickLanguage(saved, deviceLanguages());
    if (language !== i18n.language) void i18n.changeLanguage(language);
  })
  .catch(() => {
    // Storage unavailable: keep the device language.
  });

export async function setAppLanguage(language: AppLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The choice still applies for this session.
  }
}

export default i18n;
