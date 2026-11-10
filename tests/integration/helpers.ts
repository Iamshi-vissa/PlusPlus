import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const url = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321';
export const anonKey =
  process.env.SUPABASE_TEST_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export function anon(): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

/** Signs in with a local test number from supabase/config.toml (code is always 123456). */
export async function signIn(phone: string): Promise<SupabaseClient> {
  const client = anon();
  const sent = await client.auth.signInWithOtp({ phone });
  // A re-run within 60 s hits the resend limit; the fixed test code still works then.
  if (sent.error && sent.error.code !== 'over_sms_send_rate_limit') throw sent.error;
  const verified = await client.auth.verifyOtp({ phone, token: '123456', type: 'sms' });
  if (verified.error) throw verified.error;
  return client;
}

/** Local stack's well-known demo service key (NOT a secret; only for setting up test data). */
export const serviceKey =
  process.env.SUPABASE_TEST_SERVICE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export function admin(): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function userId(client: SupabaseClient): Promise<string> {
  const { data } = await client.auth.getUser();
  return data.user!.id;
}
