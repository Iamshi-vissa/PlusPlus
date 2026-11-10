import { suggestDoctorType } from '@/dispatch/suggestDoctorType';

import type { Answers, DoctorType, DoctorTypeChoice, Problem, SpecialityWeights } from './types';

const GENERAL = ['gp', 'family_medicine'];

function merge(into: SpecialityWeights, code: string, weight: number) {
  into[code] = Math.max(into[code] ?? 0, weight);
}

/** The problem's own mapping, adjusted by the follow-up answers (child → paediatrics, pregnant → obstetrics). */
export function problemWeights(
  problems: Pick<Problem, 'specialities'>[],
  answers: Answers,
): SpecialityWeights {
  const w: SpecialityWeights = {};
  for (const p of problems) for (const s of p.specialities) merge(w, s.code, s.weight);
  if (answers.patientGroup === 'child') merge(w, 'paeds', 1);
  if (answers.patientGroup === 'pregnant') merge(w, 'obgyn', 1);
  return w;
}

function weightsFor(
  type: DoctorType,
  base: SpecialityWeights,
  answers: Answers,
  manual: string | null,
): SpecialityWeights {
  if (type === 'general') {
    const w: SpecialityWeights = { gp: 1, family_medicine: 1 };
    // in India a paediatrician is the usual first doctor for children
    if (answers.patientGroup === 'child') w.paeds = 1;
    return w;
  }
  if (manual) return { [manual]: 1 };
  const specialists = Object.keys(base).filter(
    (code) => !GENERAL.includes(code) && code !== 'emergency',
  );
  if (specialists.length === 0) return { internal_medicine: 1 };
  return Object.fromEntries(specialists.map((code) => [code, 1]));
}

export type SpecialityPlan = {
  type: DoctorType;
  weights: SpecialityWeights;
  suggested: boolean;
  reasonKey?: string;
};

/**
 * PURE: which specialities to search, per the doctor-type choice (PROJECT.md "Doctor recommendation").
 * - general: GP / family medicine (+ paediatrics for a child)
 * - specialist: the problem's specialist(s) only, or the one the user picked
 * - not_sure: our suggestion, with the other type kept at 0.5 so results are never empty
 */
export function planSpecialities(
  choice: DoctorTypeChoice,
  problems: Pick<Problem, 'specialities' | 'usually_specialist'>[],
  answers: Answers,
  manualSpeciality: string | null = null,
): SpecialityPlan {
  const base = problemWeights(problems, answers);
  if (choice !== 'not_sure') {
    return {
      type: choice,
      weights: weightsFor(choice, base, answers, manualSpeciality),
      suggested: false,
    };
  }
  const suggestion = suggestDoctorType(problems, answers);
  const main = weightsFor(suggestion.type, base, answers, null);
  const other = weightsFor(
    suggestion.type === 'general' ? 'specialist' : 'general',
    base,
    answers,
    null,
  );
  const weights: SpecialityWeights = { ...main };
  for (const code of Object.keys(other)) merge(weights, code, 0.5);
  return { type: suggestion.type, weights, suggested: true, reasonKey: suggestion.reasonKey };
}
