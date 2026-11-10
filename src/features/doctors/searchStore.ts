import { useSyncExternalStore } from 'react';

import type { Answers, DoctorTypeChoice, Problem } from './types';

/** What the person told us in "Find a doctor for my problem"; carried into the booking. */
export type DoctorSearch = {
  problems: Problem[];
  description: string;
  answers: Answers;
  choice: DoctorTypeChoice;
  manualSpeciality: string | null;
};

export const EMPTY_SEARCH: DoctorSearch = {
  problems: [],
  description: '',
  answers: { duration: null, severity: null, patientGroup: null },
  choice: 'not_sure',
  manualSpeciality: null,
};

let state: DoctorSearch = EMPTY_SEARCH;
const listeners = new Set<() => void>();

export function setDoctorSearch(update: Partial<DoctorSearch>): void {
  state = { ...state, ...update };
  listeners.forEach((l) => l());
}

export function resetDoctorSearch(): void {
  setDoctorSearch(EMPTY_SEARCH);
}

export function getDoctorSearch(): DoctorSearch {
  return state;
}

export function useDoctorSearch(): DoctorSearch {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
