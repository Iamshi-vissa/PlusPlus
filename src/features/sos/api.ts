import { getSupabase } from '@/lib/supabase';

export type SosStatus =
  | 'searching'
  | 'assigned'
  | 'en_route_to_scene'
  | 'picked_up'
  | 'reached_hospital'
  | 'closed'
  | 'cancelled'
  | 'no_responder';

export const ACTIVE_STATUSES: SosStatus[] = [
  'searching',
  'assigned',
  'en_route_to_scene',
  'picked_up',
];

export type SosView = {
  id: string;
  status: SosStatus;
  wave: number;
  radius_m: number;
  created_at: string;
  alerted: number;
  deciding: number;
  lat: number;
  lng: number;
  responder: {
    name: string;
    vehicle_type: 'three_wheeler' | 'four_wheeler';
    vehicle_number: string;
    lat: number | null;
    lng: number | null;
    last_seen_at: string | null;
    distance_m: number | null;
    eta_s: number | null;
  } | null;
  hospital: { name: string; phone: string | null; lat: number; lng: number } | null;
};

export type CreateError =
  | 'not_signed_in'
  | 'phone_not_verified'
  | 'sos_suspended'
  | 'rate_limited'
  | 'outside_karnataka'
  | 'network'
  | 'failed';

export function sosErrorCode(message: string | undefined): CreateError {
  const known: CreateError[] = [
    'not_signed_in',
    'phone_not_verified',
    'sos_suspended',
    'rate_limited',
    'outside_karnataka',
  ];
  const hit = known.find((k) => message?.includes(k));
  if (hit) return hit;
  return message && /fetch|network/i.test(message) ? 'network' : 'failed';
}

export type SosDetails = {
  injuredCount: number | null;
  isConscious: boolean | null;
  canSit: boolean | null;
  note: string;
};

export async function createSos(
  lat: number,
  lng: number,
  accuracyM: number | null,
  d: SosDetails,
): Promise<{ ok: true; id: string } | { ok: false; error: CreateError }> {
  try {
    const { data, error } = await getSupabase().rpc('sos_create', {
      p_lat: lat,
      p_lng: lng,
      p_accuracy_m: accuracyM,
      p_injured_count: d.injuredCount,
      p_is_conscious: d.isConscious,
      p_patient_can_sit: d.canSit,
      p_note: d.note.trim() || null,
    });
    if (error) return { ok: false, error: sosErrorCode(error.message) };
    return { ok: true, id: data as string };
  } catch (e) {
    return { ok: false, error: sosErrorCode((e as Error).message) };
  }
}

export async function updateSosDetails(id: string, d: SosDetails): Promise<boolean> {
  const { error } = await getSupabase().rpc('sos_update_details', {
    p_sos: id,
    p_injured_count: d.injuredCount,
    p_is_conscious: d.isConscious,
    p_patient_can_sit: d.canSit,
    p_note: d.note.trim() || null,
  });
  return !error;
}

export async function getSosStatus(id: string): Promise<SosView | null> {
  const sb = getSupabase();
  await sb.rpc('sos_nudge', { p_sos: id }); // keeps waves moving even if the server timer is late
  const { data, error } = await sb.rpc('sos_status', { p_sos: id });
  if (error) throw new Error('load');
  return data as SosView | null;
}

export async function cancelSos(id: string, reason: string | null): Promise<boolean> {
  const { error } = await getSupabase().rpc('sos_cancel', { p_sos: id, p_reason: reason });
  return !error;
}

export async function closeSos(id: string): Promise<boolean> {
  const { error } = await getSupabase().rpc('sos_set_status', { p_sos: id, p_status: 'closed' });
  return !error;
}

export async function rateSos(
  id: string,
  stars: number,
  comment: string,
  report: boolean,
): Promise<boolean> {
  const { error } = await getSupabase().rpc('sos_rate', {
    p_sos: id,
    p_stars: stars,
    p_comment: comment.trim() || null,
    p_report: report,
  });
  return !error;
}

export async function myActiveSos(): Promise<string | null> {
  const { data } = await getSupabase()
    .from('sos_requests')
    .select('id, status')
    .in('status', ACTIVE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1);
  return (data?.[0]?.id as string | undefined) ?? null;
}

// ---------- Responder side ----------
export type Hospital = {
  place_id: string;
  name_en: string;
  name_kn: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  distance_m: number;
  eta_s: number;
  trauma_care: boolean;
};

export type AlertView = {
  id: string;
  status: SosStatus;
  my_response: string | null;
  assigned_to_me: boolean;
  distance_m: number;
  eta_s: number;
  sent_at: string;
  decide_by: string;
  injured_count: number | null;
  is_conscious: boolean | null;
  patient_can_sit: boolean | null;
  pickup: { lat: number; lng: number; note: string | null; raiser_name: string | null } | null;
  hospitals: Hospital[] | null;
  destination_place_id: string | null;
};

export async function getAlert(id: string): Promise<AlertView | null> {
  const { data, error } = await getSupabase().rpc('sos_for_responder', { p_sos: id });
  if (error) throw new Error('load');
  return data as AlertView | null;
}

export async function pendingAlerts(): Promise<{ sos_id: string; sent_at: string }[]> {
  const { data, error } = await getSupabase().rpc('my_pending_alerts');
  if (error) return [];
  return (data ?? []) as { sos_id: string; sent_at: string }[];
}

export async function activeSosAsResponder(): Promise<string | null> {
  const { data } = await getSupabase().rpc('my_active_sos_as_responder');
  return (data as string | null) ?? null;
}

export async function markAlertSeen(id: string): Promise<void> {
  await getSupabase().rpc('sos_alert_seen', { p_sos: id });
}

export async function acceptSos(id: string): Promise<boolean | null> {
  const { data, error } = await getSupabase().rpc('sos_accept', { p_sos: id });
  return error ? null : (data as boolean);
}

export async function declineSos(id: string): Promise<void> {
  await getSupabase().rpc('sos_decline', { p_sos: id });
}

export async function setSosStatus(
  id: string,
  status: SosStatus,
  placeId: string | null = null,
): Promise<boolean> {
  const { error } = await getSupabase().rpc('sos_set_status', {
    p_sos: id,
    p_status: status,
    p_place_id: placeId,
  });
  return !error;
}

export async function releaseSos(id: string): Promise<boolean> {
  const { error } = await getSupabase().rpc('sos_release', { p_sos: id });
  return !error;
}

export async function sharedLocation(
  token: string,
): Promise<{ status: SosStatus; lat: number; lng: number; hospital: string | null } | null> {
  const { data, error } = await getSupabase().rpc('sos_shared_location', { p_token: token });
  if (error) return null;
  return data as { status: SosStatus; lat: number; lng: number; hospital: string | null } | null;
}
