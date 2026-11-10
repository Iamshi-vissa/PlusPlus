import { getSupabase } from '@/lib/supabase';

import { authErrorKey, type AuthErrorKey } from './errors';

/** `detail` is a technical reason, filled in only in development builds, to help debugging. */
export type Result = { ok: true } | { ok: false; error: AuthErrorKey; detail?: string };

type ErrorLike = { name?: string; status?: number; code?: string; message?: string };

/** Never includes the phone number. Development builds only. */
function devDetail(error: ErrorLike): string | undefined {
  if (!__DEV__) return undefined;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '(no URL set)';
  return [error.name, error.status, error.code, error.message, `server: ${url}`]
    .filter((part) => part !== undefined && part !== '')
    .join(' · ');
}

function fail(error: ErrorLike): Result {
  return { ok: false, error: authErrorKey(error), detail: devDetail(error) };
}

/** Sends a 6-digit code by SMS. `phone` must already be normalised to +91XXXXXXXXXX. */
export async function sendOtp(phone: string): Promise<Result> {
  try {
    const { error } = await getSupabase().auth.signInWithOtp({ phone });
    return error ? fail(error) : { ok: true };
  } catch (e) {
    return fail(e as Error);
  }
}

export async function verifyOtp(phone: string, token: string): Promise<Result> {
  try {
    const { error } = await getSupabase().auth.verifyOtp({ phone, token, type: 'sms' });
    return error ? fail(error) : { ok: true };
  } catch (e) {
    return fail(e as Error);
  }
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}
