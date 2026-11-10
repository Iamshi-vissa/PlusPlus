/** Translation keys for the errors a sign-in screen can show. */
export type AuthErrorKey =
  | 'auth.errors.invalidCode'
  | 'auth.errors.smsFailed'
  | 'auth.errors.tooManyRequests'
  | 'auth.errors.network'
  | 'auth.errors.generic';

type ErrorLike = { status?: number; code?: string; message?: string; name?: string } | null;

/**
 * PURE: map a Supabase Auth error to a message key. Never shows raw server text
 * (it can contain the phone number, and it isn't translated).
 */
export function authErrorKey(error: ErrorLike): AuthErrorKey {
  if (!error) return 'auth.errors.generic';
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  // Check the SMS provider first: its messages can contain words like "invalid" too.
  if (code === 'sms_send_failed' || message.includes('sending confirmation otp')) {
    return 'auth.errors.smsFailed';
  }
  if (
    code === 'otp_expired' ||
    code === 'invalid_credentials' ||
    message.includes('token has expired or is invalid')
  ) {
    return 'auth.errors.invalidCode';
  }
  if (
    error.status === 429 ||
    code.startsWith('over_') ||
    message.includes('rate limit') ||
    message.includes('only request this after')
  ) {
    return 'auth.errors.tooManyRequests';
  }
  if (
    error.name === 'AuthRetryableFetchError' ||
    message.includes('network') ||
    message.includes('fetch')
  ) {
    return 'auth.errors.network';
  }
  return 'auth.errors.generic';
}
