import en from '@/i18n/en.json';
import kn from '@/i18n/kn.json';
import { pickLanguage } from '@/i18n/languages';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((out, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? { ...out, [path]: value }
      : { ...out, ...flatten(value, path) };
  }, {});
}

const placeholders = (text: string) => (text.match(/{{\s*\w+\s*}}/g) ?? []).sort();

describe('translations', () => {
  const english = flatten(en);
  const kannada = flatten(kn);

  it('has exactly the same keys in English and Kannada', () => {
    expect(Object.keys(kannada).sort()).toEqual(Object.keys(english).sort());
  });

  it('has no empty strings', () => {
    for (const [key, value] of [...Object.entries(english), ...Object.entries(kannada)]) {
      expect({ key, empty: value.trim() === '' }).toEqual({ key, empty: false });
    }
  });

  it('uses the same {{placeholders}} in both languages', () => {
    for (const key of Object.keys(english)) {
      expect({ key, vars: placeholders(kannada[key] ?? '') }).toEqual({
        key,
        vars: placeholders(english[key]),
      });
    }
  });

  it('keeps the emergency numbers in the Kannada call buttons', () => {
    expect(kannada['emergency.call108']).toContain('108');
    expect(kannada['emergency.call112']).toContain('112');
  });
});

describe('pickLanguage', () => {
  it('prefers the saved language', () => {
    expect(pickLanguage('kn', ['en'])).toBe('kn');
  });

  it('falls back to the first supported device language', () => {
    expect(pickLanguage(null, ['hi', 'kn', 'en'])).toBe('kn');
  });

  it('ignores an unsupported saved value', () => {
    expect(pickLanguage('fr', ['en'])).toBe('en');
  });

  it('defaults to English', () => {
    expect(pickLanguage(undefined, ['hi', null])).toBe('en');
    expect(pickLanguage(null, [])).toBe('en');
  });
});
