import type { AppLanguage } from '@/i18n/languages';
import { getSupabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  language: AppLanguage;
};

export async function getMyProfile(): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, full_name, phone, language')
    .maybeSingle<Profile>();
  if (error) throw new Error('profile.errors.loadFailed');
  return data;
}

export async function updateMyProfile(
  id: string,
  changes: Partial<Pick<Profile, 'full_name' | 'language'>>,
): Promise<boolean> {
  const { error } = await getSupabase().from('profiles').update(changes).eq('id', id);
  return !error;
}
