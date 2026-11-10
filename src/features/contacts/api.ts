import { getSupabase } from '@/lib/supabase';

import type { ValidContact } from './rules';

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relation: string | null;
};

export type SaveError =
  'contacts.errors.limit' | 'contacts.errors.duplicate' | 'contacts.errors.saveFailed';

export async function listContacts(): Promise<EmergencyContact[]> {
  const { data, error } = await getSupabase()
    .from('emergency_contacts')
    .select('id, name, phone, relation')
    .order('created_at', { ascending: true });
  if (error) throw new Error('contacts.errors.loadFailed');
  return data ?? [];
}

export async function addContact(
  contact: ValidContact,
): Promise<{ ok: true } | { ok: false; error: SaveError }> {
  // user_id is filled in by the database from the signed-in user.
  const { error } = await getSupabase().from('emergency_contacts').insert(contact);
  if (!error) return { ok: true };
  if (error.message.includes('emergency_contacts_limit'))
    return { ok: false, error: 'contacts.errors.limit' };
  if (error.code === '23505') return { ok: false, error: 'contacts.errors.duplicate' };
  return { ok: false, error: 'contacts.errors.saveFailed' };
}

export async function removeContact(id: string): Promise<boolean> {
  const { error } = await getSupabase().from('emergency_contacts').delete().eq('id', id);
  return !error;
}
