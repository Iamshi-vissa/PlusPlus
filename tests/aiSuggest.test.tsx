import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import FindDoctorScreen from '../app/doctor/index';
import {
  cleanText,
  MAX_CODES,
  outputSchema,
  type ProblemOption,
  problemList,
  sanitize,
} from '../supabase/functions/_shared/suggest';
import { listProblems, listSpecialities, suggestProblems } from '@/features/doctors/api';
import { getDoctorSearch } from '@/features/doctors/searchStore';
import type { Problem } from '@/features/doctors/types';
import i18n from '@/i18n';

jest.mock('@/features/doctors/api', () => ({
  listProblems: jest.fn(),
  listSpecialities: jest.fn(),
  suggestProblems: jest.fn(),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

const OPTIONS: ProblemOption[] = [
  { code: 'knee_pain', name_en: 'Knee or joint pain', is_red_flag: false },
  { code: 'fever', name_en: 'Fever', is_red_flag: false },
  { code: 'chest_pain', name_en: 'Chest pain', is_red_flag: true },
  { code: 'skin_rash', name_en: 'Skin rash', is_red_flag: false },
  { code: 'cough', name_en: 'Cough', is_red_flag: false },
];

describe('problem matcher helpers', () => {
  it('lists problems in a stable order and marks emergencies', () => {
    const list = problemList(OPTIONS);
    expect(list.split('\n')[0]).toBe('chest_pain: Chest pain [EMERGENCY]');
    expect(problemList([...OPTIONS].reverse())).toBe(list);
  });

  it('limits the model to known codes', () => {
    const schema = outputSchema(OPTIONS.map((o) => o.code));
    expect(schema.properties.problem_codes.items.enum).toContain('knee_pain');
    expect(schema.additionalProperties).toBe(false);
  });

  it('drops unknown and duplicate codes and keeps at most three', () => {
    const out = sanitize(
      {
        emergency: false,
        problem_codes: ['knee_pain', 'made_up', 'knee_pain', 'fever', 'cough', 'skin_rash'],
      },
      OPTIONS,
    );
    expect(out).toEqual({ emergency: false, problemCodes: ['knee_pain', 'fever', 'cough'] });
    expect(out.problemCodes.length).toBeLessThanOrEqual(MAX_CODES);
  });

  it('treats a red-flag problem as an emergency even if the model said no', () => {
    expect(sanitize({ emergency: false, problem_codes: ['chest_pain'] }, OPTIONS).emergency).toBe(
      true,
    );
  });

  it('survives garbage from the model', () => {
    expect(sanitize('nonsense', OPTIONS)).toEqual({ emergency: false, problemCodes: [] });
    expect(sanitize({ emergency: 'yes', problem_codes: 'fever' }, OPTIONS)).toEqual({
      emergency: false,
      problemCodes: [],
    });
  });

  it('cleans and caps the typed text', () => {
    expect(cleanText('  knee   pain\n on stairs ')).toBe('knee pain on stairs');
    expect(cleanText(42)).toBe('');
    expect(cleanText('a'.repeat(5000)).length).toBe(1000);
  });
});

const knee: Problem = {
  id: 1,
  code: 'knee_pain',
  name_en: 'Knee or joint pain',
  name_kn: 'ಮಂಡಿ ನೋವು',
  body_area: 'legs',
  icon: 'walk',
  is_red_flag: false,
  usually_specialist: false,
  sort: 1,
  specialities: [{ code: 'ortho', weight: 1 }],
};

describe('Find a doctor: describing the problem in your own words', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    mockPush.mockReset();
    jest.mocked(listProblems).mockResolvedValue([knee]);
    jest.mocked(listSpecialities).mockResolvedValue([]);
  });

  async function describe_(text: string) {
    await render(<FindDoctorScreen />);
    await waitFor(() => expect(listProblems).toHaveBeenCalled());
    await fireEvent.changeText(screen.getByTestId('describe'), text);
    await fireEvent.press(screen.getByTestId('next-1'));
  }

  it('picks the matching problem and says so on the next step', async () => {
    jest
      .mocked(suggestProblems)
      .mockResolvedValue({ emergency: false, problemCodes: ['knee_pain'] });
    await describe_('pain in my knee when I climb stairs');
    await waitFor(() => expect(screen.getByTestId('matched')).toBeTruthy());
    expect(screen.getByText('From what you wrote, we picked: Knee or joint pain')).toBeTruthy();
    expect(getDoctorSearch().problems.map((p) => p.code)).toEqual(['knee_pain']);
    expect(getDoctorSearch().description).toBe('pain in my knee when I climb stairs');
  });

  it('goes to the emergency screen when the matcher sees an emergency', async () => {
    jest.mocked(suggestProblems).mockResolvedValue({ emergency: true, problemCodes: [] });
    await describe_('my father suddenly fell and cannot move his arm');
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/doctor/emergency',
        params: { reasons: 'described' },
      }),
    );
  });

  it('carries on without a match when the matcher is unavailable', async () => {
    jest.mocked(suggestProblems).mockResolvedValue(null);
    await describe_('something feels off');
    await waitFor(() => expect(screen.getByTestId('next-2')).toBeTruthy());
    expect(screen.queryByTestId('matched')).toBeNull();
  });

  it('checks red-flag words on the phone before asking the matcher', async () => {
    jest.mocked(suggestProblems).mockClear();
    await describe_('chest pain since morning');
    expect(mockPush).toHaveBeenCalled();
    expect(suggestProblems).not.toHaveBeenCalled();
  });
});
