import {
  bayesianRating,
  daysUntil,
  DOCTOR_RANKING,
  rankDoctors,
  type DoctorCandidate,
} from '@/dispatch/rankDoctors';
import { suggestDoctorType } from '@/dispatch/suggestDoctorType';
import { checkRedFlags } from '@/features/doctors/redFlags';
import { planSpecialities, problemWeights } from '@/features/doctors/specialityWeights';
import type { Answers } from '@/features/doctors/types';

const none: Answers = { duration: null, severity: null, patientGroup: null };
const knee = {
  code: 'joint_knee_pain',
  is_red_flag: false,
  usually_specialist: false,
  specialities: [
    { code: 'ortho', weight: 1 },
    { code: 'gp', weight: 0.6 },
  ],
};
const fever = {
  code: 'fever_cold',
  is_red_flag: false,
  usually_specialist: false,
  specialities: [
    { code: 'gp', weight: 1 },
    { code: 'internal_medicine', weight: 0.6 },
  ],
};
const eye = {
  code: 'eye_problem',
  is_red_flag: false,
  usually_specialist: true,
  specialities: [{ code: 'eye', weight: 1 }],
};
const chest = {
  code: 'chest_pain',
  is_red_flag: true,
  usually_specialist: false,
  specialities: [{ code: 'emergency', weight: 1 }],
};

describe('checkRedFlags', () => {
  it('flags a red-flag problem that was picked', () => {
    expect(checkRedFlags([chest], '', none)).toEqual({ emergency: true, reasons: ['picked'] });
  });

  it.each([
    ['my father has chest pain since morning', 'chest'],
    ["I can't breathe properly", 'breathing'],
    ['she fainted in the kitchen', 'unconscious'],
    ['face drooping on one side', 'stroke'],
    ['the cut is bleeding a lot', 'bleeding'],
    ['bike accident near the signal', 'injury'],
    ['ಅಪ್ಪನಿಗೆ ಎದೆ ನೋವು ಇದೆ', 'chest'],
    ['ಉಸಿರಾಡಲು ಆಗುತ್ತಿಲ್ಲ', 'breathing'],
    ['ಹಾವು ಕಚ್ಚಿದೆ', 'poisoning'],
    ['I want to end my life', 'self_harm'],
  ])('flags "%s"', (text, reason) => {
    const result = checkRedFlags([knee], text, none);
    expect(result.emergency).toBe(true);
    expect(result.emergency && result.reasons).toContain(reason);
  });

  it('flags a child with fever who is very drowsy', () => {
    expect(
      checkRedFlags([fever], 'high fever and very drowsy', { ...none, patientGroup: 'child' }),
    ).toEqual({
      emergency: true,
      reasons: ['child_fever'],
    });
    expect(
      checkRedFlags([fever], '', { ...none, patientGroup: 'child', severity: 'severe' }).emergency,
    ).toBe(true);
  });

  it('does not flag everyday problems or look-alike words', () => {
    expect(checkRedFlags([knee], 'Pain in right knee for 2 weeks, worse on stairs.', none)).toEqual(
      { emergency: false },
    );
    expect(checkRedFlags([fever], 'what are the benefits of rest', none)).toEqual({
      emergency: false,
    });
    expect(
      checkRedFlags([fever], 'mild fever', { ...none, patientGroup: 'adult', severity: 'severe' }),
    ).toEqual({ emergency: false });
  });
});

describe('suggestDoctorType', () => {
  it('suggests a general doctor for a mild problem of a few days', () => {
    expect(
      suggestDoctorType([knee], { duration: 'few_days', severity: 'mild', patientGroup: 'adult' }),
    ).toEqual({
      type: 'general',
      reasonKey: 'doctors.reason.everyday',
    });
  });
  it('suggests a specialist for weeks, severe, or specialist-type problems', () => {
    expect(suggestDoctorType([knee], { ...none, duration: 'weeks' }).type).toBe('specialist');
    expect(suggestDoctorType([knee], { ...none, severity: 'severe' }).type).toBe('specialist');
    expect(suggestDoctorType([eye], none)).toEqual({
      type: 'specialist',
      reasonKey: 'doctors.reason.usuallySpecialist',
    });
  });
  it('gives a child-specific reason', () => {
    expect(suggestDoctorType([fever], { ...none, patientGroup: 'child' }).reasonKey).toBe(
      'doctors.reason.child',
    );
  });
});

describe('planSpecialities', () => {
  it('general → GP and family medicine (+ paediatrics for a child)', () => {
    expect(planSpecialities('general', [knee], none).weights).toEqual({
      gp: 1,
      family_medicine: 1,
    });
    expect(planSpecialities('general', [knee], { ...none, patientGroup: 'child' }).weights).toEqual(
      { gp: 1, family_medicine: 1, paeds: 1 },
    );
  });
  it('specialist → only the specialists, GP fallback removed', () => {
    expect(planSpecialities('specialist', [knee], none).weights).toEqual({ ortho: 1 });
  });
  it('specialist chosen by hand → only that one', () => {
    expect(planSpecialities('specialist', [knee], none, 'physio').weights).toEqual({ physio: 1 });
  });
  it('specialist for a GP-type problem falls back to internal medicine', () => {
    expect(planSpecialities('specialist', [fever], none).weights).toEqual({ internal_medicine: 1 });
  });
  it('not sure → suggestion at 1.0, the other type at 0.5', () => {
    const plan = planSpecialities('not_sure', [knee], {
      duration: 'weeks',
      severity: 'mild',
      patientGroup: 'adult',
    });
    expect(plan).toMatchObject({
      type: 'specialist',
      suggested: true,
      reasonKey: 'doctors.reason.weeks',
    });
    expect(plan.weights).toEqual({ ortho: 1, gp: 0.5, family_medicine: 0.5 });
  });
  it('adds obstetrics for pregnancy', () => {
    expect(problemWeights([fever], { ...none, patientGroup: 'pregnant' })).toMatchObject({
      obgyn: 1,
    });
  });
});

describe('rankDoctors', () => {
  const now = new Date('2026-11-10T04:30:00Z'); // 10:00 IST
  const base: DoctorCandidate = {
    doctor_id: 'x',
    name: 'Dr X',
    specialities: ['ortho'],
    years_experience: 10,
    languages: ['kn', 'en'],
    fee: 300,
    rating_sum: 0,
    rating_count: 0,
    distance_m: 2000,
    next_slot_at: '2026-11-10T09:00:00Z',
    mean_rating: 4,
  };

  it('weights add up to 1', () => {
    const sum = Object.values(DOCTOR_RANKING.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('counts days in India time', () => {
    expect(daysUntil('2026-11-10T17:00:00Z', now)).toBe(0); // 22:30 IST same day
    expect(daysUntil('2026-11-10T19:00:00Z', now)).toBe(1); // 00:30 IST next day
  });

  it('uses a Bayesian rating so one 5-star review does not beat 200 at 4.6', () => {
    expect(bayesianRating(5, 1, 4)).toBeLessThan(bayesianRating(920, 200, 4));
  });

  it('prefers the right speciality, then sooner slots and closer clinics', () => {
    const ranked = rankDoctors(
      [
        { ...base, doctor_id: 'gp', specialities: ['gp'] },
        { ...base, doctor_id: 'ortho-far', distance_m: 9000 },
        { ...base, doctor_id: 'ortho-near', distance_m: 500 },
        { ...base, doctor_id: 'ortho-later', next_slot_at: '2026-11-15T05:00:00Z' },
      ],
      { ortho: 1, gp: 0.5 },
      { radiusM: 10000, language: 'kn', now },
    );
    expect(ranked.map((d) => d.doctor_id)).toEqual([
      'ortho-near',
      'ortho-far',
      'ortho-later',
      'gp',
    ]);
    expect(ranked.filter((d) => d.bestMatch).map((d) => d.doctor_id)).toEqual([
      'ortho-near',
      'ortho-far',
      'ortho-later',
    ]);
  });

  it('computes the documented score exactly', () => {
    const [d] = rankDoctors([base], { ortho: 1 }, { radiusM: 10000, language: 'kn', now });
    // 0.30·1 + 0.20·1 (today) + 0.20·0.8 + 0.15·0.75 (bayes = mean 4 → (4-1)/4) + 0.10·0.5 + 0.05·1
    expect(d.score).toBeCloseTo(0.3 + 0.2 + 0.16 + 0.1125 + 0.05 + 0.05, 10);
    expect(d.reasons).toEqual([
      { kind: 'speciality', code: 'ortho' },
      { kind: 'slot', days: 0 },
      { kind: 'distance', meters: 2000 },
      { kind: 'language', language: 'kn' },
    ]);
  });

  it('never labels a fallback-speciality doctor "Best match", even when ranked first', () => {
    const ranked = rankDoctors(
      [
        {
          ...base,
          doctor_id: 'gp-near-today',
          specialities: ['gp'],
          distance_m: 100,
          years_experience: 20,
          rating_sum: 50,
          rating_count: 10,
        },
        {
          ...base,
          doctor_id: 'ortho-far-later',
          distance_m: 9500,
          next_slot_at: '2026-11-16T05:00:00Z',
          years_experience: 1,
        },
      ],
      { ortho: 1, gp: 0.5 },
      { radiusM: 10000, language: 'kn', now },
    );
    expect(ranked[0].doctor_id).toBe('gp-near-today');
    expect(ranked.map((d) => [d.doctor_id, d.bestMatch])).toEqual([
      ['gp-near-today', false],
      ['ortho-far-later', true],
    ]);
  });

  it('shows at most 20 doctors', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...base, doctor_id: `d${i}` }));
    expect(rankDoctors(many, { ortho: 1 }, { radiusM: 10000, language: 'en', now })).toHaveLength(
      20,
    );
  });
});
