import { getSupabase } from '@/lib/supabase';

export async function exportMyData(): Promise<string | null> {
  const { data, error } = await getSupabase().rpc('export_my_data');
  return error ? null : JSON.stringify(data, null, 2);
}

export async function deleteMyAccount(): Promise<null | 'active_sos' | 'failed'> {
  const sb = getSupabase();
  const { error } = await sb.rpc('delete_my_account');
  if (error) return error.message.includes('active_sos') ? 'active_sos' : 'failed';
  await sb.auth.signOut();
  return null;
}

export async function reportProblem(
  subjectType: string,
  subjectId: string,
  reason: string,
  details: string,
): Promise<boolean> {
  const { error } = await getSupabase()
    .from('reports')
    .insert({
      subject_type: subjectType,
      subject_id: subjectId,
      reason,
      details: details.trim() || null,
    });
  return !error;
}
