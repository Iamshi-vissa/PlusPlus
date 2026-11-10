/** Indian mobile numbers: 10 digits starting with 6, 7, 8 or 9. Stored as E.164 (+91XXXXXXXXXX). */
const MOBILE = /^[6-9]\d{9}$/;

/**
 * PURE: turn what a person typed into a +91 mobile number, or null if it isn't one.
 * Accepts spaces, dashes, brackets and an optional +91 / 91 / 0 prefix.
 */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return MOBILE.test(digits) ? `+91${digits}` : null;
}

/** PURE: "+919876543210" → "+91 98765 43210" for display. */
export function formatIndianMobile(e164: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return match ? `+91 ${match[1]} ${match[2]}` : e164;
}

export const OTP_LENGTH = 6;

/** PURE: a one-time code is exactly 6 digits. */
export function isValidOtp(code: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code.trim());
}
