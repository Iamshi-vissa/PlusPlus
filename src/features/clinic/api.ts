import type { LatLng } from '@/lib/geo/karnataka';
import { getSupabase } from '@/lib/supabase';

export type ClinicApplication = {
  id: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_note: string | null;
};

export async function myClinicApplications(): Promise<ClinicApplication[]> {
  const { data, error } = await getSupabase()
    .from('clinic_applications')
    .select('id, name, status, reviewer_note')
    .order('created_at', { ascending: false });
  if (error) throw new Error('load');
  return data ?? [];
}

export type NewClinic = {
  name: string;
  type: 'clinic' | 'hospital';
  address: string;
  phone: string;
  location: LatLng;
  registrationNo: string;
  hfrFacilityId: string | null;
  documentPath: string | null;
};

export async function applyClinic(
  c: NewClinic,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await getSupabase()
    .from('clinic_applications')
    .insert({
      name: c.name.trim(),
      type: c.type,
      address: c.address.trim(),
      phone: c.phone,
      location: `SRID=4326;POINT(${c.location.lng} ${c.location.lat})`,
      registration_no: c.registrationNo.trim(),
      hfr_facility_id: c.hfrFacilityId?.trim().toUpperCase() || null,
      document_path: c.documentPath,
    });
  if (!error) return { ok: true };
  const known = ['outside_karnataka', 'application_pending'].find((k) => error.message.includes(k));
  return { ok: false, error: known ?? 'failed' };
}

export type MyClinic = { place_id: string; place: { id: string; name_en: string } | null };

export async function myClinics(): Promise<MyClinic[]> {
  const { data, error } = await getSupabase()
    .from('clinic_admins')
    .select('place_id, place:places(id, name_en)');
  if (error) throw new Error('load');
  return (data ?? []) as unknown as MyClinic[];
}

export type ClinicBooking = {
  id: string;
  starts_at: string;
  status: string;
  doctor_id: string;
  doctor_name: string;
  patient_name: string | null;
  patient_phone: string | null;
  problem_code: string | null;
  problem_description: string | null;
};

export async function clinicBookings(placeId: string): Promise<ClinicBooking[]> {
  const { data, error } = await getSupabase().rpc('clinic_appointments', { p_place_id: placeId });
  if (error) throw new Error('load');
  return (data ?? []) as ClinicBooking[];
}

export async function markAppointment(
  id: string,
  status: 'completed' | 'no_show',
): Promise<boolean> {
  const { error } = await getSupabase().rpc('mark_appointment', { p_id: id, p_status: status });
  return !error;
}

export type NewDoctor = {
  placeId: string;
  name: string;
  gender: 'female' | 'male' | 'other' | null;
  specialities: string[];
  qualifications: string;
  yearsExperience: number;
  languages: string[];
  fee: number;
  nmcRegistrationNo: string;
};

export async function addDoctor(d: NewDoctor): Promise<boolean> {
  const { error } = await getSupabase()
    .from('doctors')
    .insert({
      place_id: d.placeId,
      name: d.name.trim(),
      gender: d.gender,
      specialities: d.specialities,
      qualifications: d.qualifications.trim(),
      years_experience: d.yearsExperience,
      languages: d.languages,
      fee: d.fee,
      nmc_registration_no: d.nmcRegistrationNo.trim() || null,
    });
  return !error;
}

/** Same hours Mon–Sat for the next 14 days. */
export async function createWeekdaySlots(
  doctorId: string,
  from: string,
  to: string,
  minutes: number,
): Promise<number | null> {
  const span = [[from, to]];
  const week = { mon: span, tue: span, wed: span, thu: span, fri: span, sat: span, sun: [] };
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const { data, error } = await getSupabase().rpc('generate_slots', {
    p_doctor_id: doctorId,
    p_from: today,
    p_days: 14,
    p_week: week,
    p_slot_minutes: minutes,
  });
  return error ? null : (data as number);
}

export function isTime(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}
