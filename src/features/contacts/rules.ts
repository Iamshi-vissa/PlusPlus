import { normalizeIndianMobile } from '@/features/auth/phone';

export const MAX_EMERGENCY_CONTACTS = 5;
export const MAX_NAME_LENGTH = 60;
export const MAX_RELATION_LENGTH = 30;

export type ContactInput = { name: string; phone: string; relation: string };
export type ValidContact = { name: string; phone: string; relation: string | null };
export type ContactErrorKey =
  | 'contacts.errors.nameRequired'
  | 'contacts.errors.nameTooLong'
  | 'contacts.errors.phoneInvalid'
  | 'contacts.errors.relationTooLong'
  | 'contacts.errors.ownNumber'
  | 'contacts.errors.duplicate';

export type ContactValidation =
  | { ok: true; value: ValidContact }
  | { ok: false; errors: Partial<Record<keyof ContactInput, ContactErrorKey>> };

/**
 * PURE: check a new emergency contact before saving. The database enforces the same
 * rules (format, uniqueness, limit of 5); this gives friendly messages first.
 */
export function validateContact(
  input: ContactInput,
  context: { ownPhone: string | null; existingPhones: readonly string[] },
): ContactValidation {
  const errors: Partial<Record<keyof ContactInput, ContactErrorKey>> = {};
  const name = input.name.trim();
  const relation = input.relation.trim();
  const phone = normalizeIndianMobile(input.phone);

  if (!name) errors.name = 'contacts.errors.nameRequired';
  else if (name.length > MAX_NAME_LENGTH) errors.name = 'contacts.errors.nameTooLong';

  if (!phone) errors.phone = 'contacts.errors.phoneInvalid';
  else if (phone === context.ownPhone) errors.phone = 'contacts.errors.ownNumber';
  else if (context.existingPhones.includes(phone)) errors.phone = 'contacts.errors.duplicate';

  if (relation.length > MAX_RELATION_LENGTH) errors.relation = 'contacts.errors.relationTooLong';

  if (Object.keys(errors).length > 0 || !phone) return { ok: false, errors };
  return { ok: true, value: { name, phone, relation: relation || null } };
}

export function canAddContact(count: number): boolean {
  return count < MAX_EMERGENCY_CONTACTS;
}
