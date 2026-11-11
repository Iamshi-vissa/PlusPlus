import type { DoctorCandidate } from '@/dispatch/rankDoctors';
import { getSupabase } from '@/lib/supabase';

import type { Answers, DoctorTypeChoice, Problem } from './types';

export async function listProblems(): Promise<Problem[]> {
  const { data, error } = await getSupabase()
    .from('problems')
    .select(
      'id, code, name_en, name_kn, body_area, icon, is_red_flag, usually_specialist, sort, problem_specialities(speciality_code, weight)',
    )
    .order('sort');
  if (error) throw new Error('load');
  type Row = Omit<Problem, 'specialities'> & {
    problem_specialities: { speciality_code: string; weight: number }[];
  };
  return ((data ?? []) as unknown as Row[]).map(({ problem_specialities, ...p }) => ({
    ...p,
    specialities: problem_specialities.map((s) => ({
      code: s.speciality_code,
      weight: Number(s.weight),
    })),
  }));
}

export type Speciality = { code: string; name_en: string; name_kn: string };

export async function listSpecialities(): Promise<Speciality[]> {
  const { data, error } = await getSupabase()
    .from('specialities')
    .select('code, name_en, name_kn')
    .order('name_en');
  if (error) throw new Error('load');
  return data ?? [];
}

export type FoundDoctor = DoctorCandidate & {
  gender: string | null;
  qualifications: string;
  place_id: string;
  place_name: string;
  place_type: string;
  ownership: string | null;
};

export type DoctorFilters = {
  radiusM: number;
  maxFee: number | null;
  gender: 'female' | 'male' | null;
  language: string | null;
  ownership: 'government' | 'private' | null;
  todayOnly: boolean;
};

export async function findDoctors(
  lat: number,
  lng: number,
  specialities: string[],
  f: DoctorFilters,
): Promise<FoundDoctor[]> {
  const { data, error } = await getSupabase().rpc('find_doctors', {
    p_lat: lat,
    p_lng: lng,
    p_specialities: specialities,
    p_radius_m: f.radiusM,
    p_max_fee: f.maxFee,
    p_gender: f.gender,
    p_language: f.language,
    p_ownership: f.ownership,
    p_today_only: f.todayOnly,
  });
  if (error) throw new Error('load');
  return (data ?? []) as FoundDoctor[];
}

export type Doctor = {
  id: string;
  name: string;
  gender: string | null;
  specialities: string[];
  qualifications: string;
  years_experience: number;
  languages: string[];
  fee: number;
  rating_sum: number;
  rating_count: number;
  verified_at: string | null;
  is_active: boolean;
  place: {
    id: string;
    name_en: string;
    phone: string | null;
    cancel_cutoff_minutes: number;
  } | null;
};

const DOCTOR_COLUMNS =
  'id, name, gender, specialities, qualifications, years_experience, languages, fee, rating_sum, rating_count, verified_at, is_active, place:places(id, name_en, phone, cancel_cutoff_minutes)';

export async function listDoctorsAtPlace(placeId: string): Promise<Doctor[]> {
  const { data, error } = await getSupabase()
    .from('doctors')
    .select(DOCTOR_COLUMNS)
    .eq('place_id', placeId)
    .order('name');
  if (error) throw new Error('load');
  return (data ?? []) as unknown as Doctor[];
}

export async function getDoctor(id: string): Promise<Doctor | null> {
  const { data, error } = await getSupabase()
    .from('doctors')
    .select(DOCTOR_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('load');
  return data as unknown as Doctor | null;
}

export type Slot = { id: string; starts_at: string; ends_at: string };

export async function listOpenSlots(doctorId: string, days = 7): Promise<Slot[]> {
  const until = new Date(Date.now() + days * 86400000).toISOString();
  const { data, error } = await getSupabase()
    .from('slots')
    .select('id, starts_at, ends_at')
    .eq('doctor_id', doctorId)
    .eq('status', 'open')
    .gt('starts_at', new Date().toISOString())
    .lt('starts_at', until)
    .order('starts_at')
    .limit(500);
  if (error) throw new Error('load');
  return data ?? [];
}

export type BookingContext = {
  problemCode: string | null;
  description: string;
  choice: DoctorTypeChoice | null;
  answers: Answers;
};

export type BookingError = 'slot_taken' | 'too_many_upcoming' | 'past_cutoff' | 'failed';

/** Maps a database error to one of our known codes (never shows raw server text). */
export function bookingErrorCode(message: string | undefined): BookingError {
  for (const code of ['slot_taken', 'too_many_upcoming', 'past_cutoff'] as const) {
    if (message?.includes(code)) return code;
  }
  return 'failed';
}

export async function bookAppointment(
  slotId: string,
  ctx: BookingContext,
): Promise<{ ok: true; id: string } | { ok: false; error: BookingError }> {
  const { data, error } = await getSupabase().rpc('book_appointment', {
    p_slot_id: slotId,
    p_problem_code: ctx.problemCode,
    p_description: ctx.description.trim() || null,
    p_doctor_type_choice: ctx.choice,
    p_duration: ctx.answers.duration,
    p_severity: ctx.answers.severity,
    p_patient_group: ctx.answers.patientGroup,
  });
  if (error) return { ok: false, error: bookingErrorCode(error.message) };
  return { ok: true, id: data as string };
}

export async function rescheduleAppointment(
  id: string,
  newSlotId: string,
): Promise<{ ok: true } | { ok: false; error: BookingError }> {
  const { error } = await getSupabase().rpc('reschedule_appointment', {
    p_id: id,
    p_new_slot_id: newSlotId,
  });
  return error ? { ok: false, error: bookingErrorCode(error.message) } : { ok: true };
}

export async function cancelAppointment(
  id: string,
): Promise<{ ok: true } | { ok: false; error: BookingError }> {
  const { error } = await getSupabase().rpc('cancel_appointment', { p_id: id });
  return error ? { ok: false, error: bookingErrorCode(error.message) } : { ok: true };
}

export type MyAppointment = {
  id: string;
  starts_at: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  problem_description: string | null;
  doctor: { id: string; name: string; specialities: string[] } | null;
  place: {
    id: string;
    name_en: string;
    phone: string | null;
    cancel_cutoff_minutes: number;
  } | null;
  reviewed: boolean;
};

export async function myAppointments(): Promise<MyAppointment[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('appointments')
    .select(
      'id, starts_at, status, problem_description, doctor:doctors(id, name, specialities), place:places(id, name_en, phone, cancel_cutoff_minutes)',
    )
    .order('starts_at', { ascending: false })
    .limit(100);
  if (error) throw new Error('load');
  const { data: reviews } = await sb.rpc('my_reviewed_appointments');
  const reviewed = new Set(
    ((reviews ?? []) as { appointment_id: string }[]).map((r) => r.appointment_id),
  );
  return ((data ?? []) as unknown as Omit<MyAppointment, 'reviewed'>[]).map((a) => ({
    ...a,
    reviewed: reviewed.has(a.id),
  }));
}

export async function submitReview(
  appointmentId: string,
  stars: number,
  comment: string,
): Promise<boolean> {
  const { error } = await getSupabase().rpc('submit_review', {
    p_appointment_id: appointmentId,
    p_stars: stars,
    p_comment: comment.trim() || null,
  });
  return !error;
}

export type ProblemSuggestion = { emergency: boolean; problemCodes: string[] };

/**
 * Matches the user's own words to problem codes (Edge Function `suggest-problems`).
 * Returns null when the matcher is unavailable (not set up, offline, rate limited) so the
 * search simply carries on without it.
 */
export async function suggestProblems(text: string): Promise<ProblemSuggestion | null> {
  try {
    const { data, error } = await getSupabase().functions.invoke<ProblemSuggestion>(
      'suggest-problems',
      { body: { text } },
    );
    if (error || !data || !Array.isArray(data.problemCodes)) return null;
    return { emergency: data.emergency === true, problemCodes: data.problemCodes };
  } catch {
    return null;
  }
}
