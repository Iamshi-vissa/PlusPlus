import type { Answers, DoctorType, Problem } from '@/features/doctors/types';

export type DoctorTypeSuggestion = {
  type: DoctorType;
  /** translation key for the one-line reason shown in the app */
  reasonKey:
    | 'doctors.reason.weeks'
    | 'doctors.reason.severe'
    | 'doctors.reason.usuallySpecialist'
    | 'doctors.reason.everyday'
    | 'doctors.reason.child';
};

/**
 * PURE: "Not sure — suggest for me".
 * Specialist if it has lasted weeks, is severe, or the problem usually needs a specialist
 * (eyes, teeth, pregnancy, skin, follow-up of a known condition); otherwise a general doctor.
 */
export function suggestDoctorType(
  problems: Pick<Problem, 'usually_specialist'>[],
  answers: Answers,
): DoctorTypeSuggestion {
  if (answers.duration === 'weeks')
    return { type: 'specialist', reasonKey: 'doctors.reason.weeks' };
  if (answers.severity === 'severe')
    return { type: 'specialist', reasonKey: 'doctors.reason.severe' };
  if (problems.some((p) => p.usually_specialist)) {
    return { type: 'specialist', reasonKey: 'doctors.reason.usuallySpecialist' };
  }
  if (answers.patientGroup === 'child')
    return { type: 'general', reasonKey: 'doctors.reason.child' };
  return { type: 'general', reasonKey: 'doctors.reason.everyday' };
}
