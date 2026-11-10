import { authErrorKey } from '@/features/auth/errors';

describe('authErrorKey', () => {
  it('maps a wrong or expired code', () => {
    expect(authErrorKey({ code: 'otp_expired', message: 'Token has expired or is invalid' })).toBe(
      'auth.errors.invalidCode',
    );
  });
  it('maps an SMS provider failure, even when its text says "invalid"', () => {
    expect(
      authErrorKey({
        status: 422,
        code: 'sms_send_failed',
        message: 'Error sending confirmation OTP to provider: invalid credentials',
      }),
    ).toBe('auth.errors.smsFailed');
  });

  it('maps rate limits', () => {
    expect(authErrorKey({ status: 429, message: 'Too many requests' })).toBe(
      'auth.errors.tooManyRequests',
    );
    expect(authErrorKey({ code: 'over_sms_send_rate_limit' })).toBe('auth.errors.tooManyRequests');
    expect(
      authErrorKey({
        message: 'For security purposes, you can only request this after 52 seconds.',
      }),
    ).toBe('auth.errors.tooManyRequests');
  });
  it('maps network failures', () => {
    expect(authErrorKey({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' })).toBe(
      'auth.errors.network',
    );
  });
  it('falls back to a generic message and never echoes server text', () => {
    expect(authErrorKey({ message: 'Database error for +919876543210' })).toBe(
      'auth.errors.generic',
    );
    expect(authErrorKey(null)).toBe('auth.errors.generic');
  });
});
