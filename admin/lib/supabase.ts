'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Browser client with the public key. Every admin action is checked by the database (is_platform_admin). */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      {
        auth: { persistSession: true, autoRefreshToken: true },
      },
    );
  }
  return client;
}

/** Short-lived (5 min) link to a private document. Only works for platform admins (storage policy). */
export async function signedUrl(
  bucket: 'clinic-docs' | 'responder-docs',
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase().storage.from(bucket).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

export function errorText(e: { message?: string } | null): string | null {
  if (!e) return null;
  if (e.message?.includes('not_allowed')) return 'You are not a platform admin.';
  return 'Something went wrong. Please try again.';
}
