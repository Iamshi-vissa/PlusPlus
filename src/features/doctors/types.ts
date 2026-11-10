export type Duration = 'today' | 'few_days' | 'weeks';
export type Severity = 'mild' | 'moderate' | 'severe';
export type PatientGroup = 'adult' | 'child' | 'elderly' | 'pregnant';
export type DoctorType = 'general' | 'specialist';
export type DoctorTypeChoice = DoctorType | 'not_sure';

export type Answers = {
  duration: Duration | null;
  severity: Severity | null;
  patientGroup: PatientGroup | null;
};

export type Problem = {
  id: number;
  code: string;
  name_en: string;
  name_kn: string;
  body_area: BodyArea;
  icon: string;
  is_red_flag: boolean;
  usually_specialist: boolean;
  sort: number;
  specialities: { code: string; weight: number }[];
};

export type BodyArea =
  | 'head'
  | 'chest'
  | 'stomach'
  | 'back'
  | 'arms'
  | 'legs'
  | 'skin'
  | 'general'
  | 'mind'
  | 'women'
  | 'child';

/** speciality code → weight (0–1) */
export type SpecialityWeights = Record<string, number>;
