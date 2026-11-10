/**
 * Runs against a local Supabase stack, through the real Auth server and API:
 *   pnpm supabase start
 *   pnpm test:integration
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { anonKey, signIn, url } from './helpers';

// Test numbers from supabase/config.toml: no SMS is sent and the code is always 123456.
const USER_A = '+919999900001';
const USER_B = '+919999900002';

describe('phone sign-in, profile and emergency contacts (local Supabase)', () => {
  let a: SupabaseClient;
  let b: SupabaseClient;

  beforeAll(async () => {
    a = await signIn(USER_A);
    b = await signIn(USER_B);
    // Start from a clean slate for repeat runs.
    for (const client of [a, b]) {
      const { data: me } = await client.from('profiles').select('id').single();
      await client.from('profiles').update({ full_name: null, language: 'en' }).eq('id', me!.id);
    }
    await a.from('emergency_contacts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await b.from('emergency_contacts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  it('rejects a wrong code', async () => {
    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await client.auth.verifyOtp({ phone: USER_A, token: '000000', type: 'sms' });
    expect(error).not.toBeNull();
  });

  it('has a profile with the +91 phone, created at first sign-in', async () => {
    const { data, error } = await a.from('profiles').select('phone, language').single();
    expect(error).toBeNull();
    expect(data).toEqual({ phone: USER_A, language: 'en' });
  });

  it('lets a user save their name and language', async () => {
    const { data: me } = await a.from('profiles').select('id').single();
    const { error } = await a
      .from('profiles')
      .update({ full_name: 'Asha', language: 'kn' })
      .eq('id', me!.id);
    expect(error).toBeNull();
    const { data } = await a.from('profiles').select('full_name, language').single();
    expect(data).toEqual({ full_name: 'Asha', language: 'kn' });
  });

  it('keeps each user’s data private', async () => {
    const { error } = await a
      .from('emergency_contacts')
      .insert({ name: 'Amma', phone: '+919845000001' });
    expect(error).toBeNull();

    const { data: bProfiles } = await b.from('profiles').select('phone');
    expect(bProfiles).toEqual([{ phone: USER_B }]);
    const { data: bContacts } = await b.from('emergency_contacts').select('*');
    expect(bContacts).toEqual([]);

    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: anonContacts } = await anon.from('emergency_contacts').select('*');
    expect(anonContacts ?? []).toEqual([]);
  });

  it('stops at 5 emergency contacts', async () => {
    for (const n of [2, 3, 4, 5]) {
      const { error } = await a
        .from('emergency_contacts')
        .insert({ name: `C${n}`, phone: `+91984500000${n}` });
      expect(error).toBeNull();
    }
    const { error } = await a
      .from('emergency_contacts')
      .insert({ name: 'C6', phone: '+919845000006' });
    expect(error?.message).toContain('emergency_contacts_limit');
  });
});
