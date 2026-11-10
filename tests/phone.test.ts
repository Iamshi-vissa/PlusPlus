import { formatIndianMobile, isValidOtp, normalizeIndianMobile } from '@/features/auth/phone';

describe('normalizeIndianMobile', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['(987) 654-3210', '+919876543210'],
    ['6000000000', '+916000000000'],
  ])('accepts %s', (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each([
    ['', 'empty'],
    ['12345', 'too short'],
    ['5876543210', 'starts with 5 (not a mobile)'],
    ['98765432101', 'too long'],
    ['1800 123 4567', 'toll-free number'],
    ['+1 9876543210', 'not India'],
    ['98765abcde', 'letters'],
  ])('rejects %s (%s)', (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });
});

describe('formatIndianMobile', () => {
  it('groups the digits', () => {
    expect(formatIndianMobile('+919876543210')).toBe('+91 98765 43210');
  });
  it('leaves anything else alone', () => {
    expect(formatIndianMobile('12345')).toBe('12345');
  });
});

describe('isValidOtp', () => {
  it('needs exactly 6 digits', () => {
    expect(isValidOtp('123456')).toBe(true);
    expect(isValidOtp(' 123456 ')).toBe(true);
    expect(isValidOtp('12345')).toBe(false);
    expect(isValidOtp('1234567')).toBe(false);
    expect(isValidOtp('12a456')).toBe(false);
  });
});
