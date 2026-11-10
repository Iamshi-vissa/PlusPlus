import { getSupabase } from '@/lib/supabase';

export type Responder = {
  user_id: string;
  vehicle_type: 'three_wheeler' | 'four_wheeler';
  vehicle_number: string;
  verification_status: 'pending' | 'verified' | 'rejected' | 'suspended';
  reviewer_note: string | null;
  guide_completed_at: string | null;
  is_available: boolean;
  last_seen_at: string | null;
  alerts_received: number;
  alerts_accepted: number;
  helped_count: number;
};

export async function getMyResponder(): Promise<Responder | null> {
  const { data, error } = await getSupabase()
    .from('responders')
    .select(
      'user_id, vehicle_type, vehicle_number, verification_status, reviewer_note, guide_completed_at, is_available, last_seen_at, alerts_received, alerts_accepted, helped_count',
    )
    .maybeSingle();
  if (error) throw new Error('load');
  return data as Responder | null;
}

export type Application = {
  vehicleType: 'three_wheeler' | 'four_wheeler';
  vehicleNumber: string;
  licenceNumber: string;
  licencePath: string;
  rcPath: string;
  vehiclePhotoPath: string;
  selfiePath: string;
};

/** Returns null on success, or an error code from the server. */
export async function applyAsResponder(a: Application): Promise<string | null> {
  const { error } = await getSupabase().rpc('responder_apply', {
    p_vehicle_type: a.vehicleType,
    p_vehicle_number: a.vehicleNumber,
    p_licence_number: a.licenceNumber,
    p_licence_doc_path: a.licencePath,
    p_rc_doc_path: a.rcPath,
    p_vehicle_photo_path: a.vehiclePhotoPath,
    p_selfie_path: a.selfiePath,
  });
  return error
    ? (['suspended', 'bad_document'].find((c) => error.message.includes(c)) ?? 'failed')
    : null;
}

export async function completeGuide(): Promise<boolean> {
  const { error } = await getSupabase().rpc('responder_complete_guide');
  return !error;
}

export async function setAvailable(available: boolean): Promise<string | null> {
  const { error } = await getSupabase().rpc('responder_set_available', { p_available: available });
  return error
    ? (['not_verified', 'guide_not_read', 'not_a_responder'].find((c) =>
        error.message.includes(c),
      ) ?? 'failed')
    : null;
}

export async function sendHeartbeat(lat: number, lng: number, accuracyM: number): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('responder_heartbeat', {
    p_lat: lat,
    p_lng: lng,
    p_accuracy_m: accuracyM,
  });
  return !error && data === true;
}
