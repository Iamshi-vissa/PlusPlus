import { canAddContact, validateContact } from '@/features/contacts/rules';

const ctx = { ownPhone: '+919999900001', existingPhones: ['+919900000001'] };

describe('validateContact', () => {
  it('accepts and cleans a valid contact', () => {
    expect(
      validateContact({ name: '  Amma ', phone: '98450 12345', relation: ' Mother ' }, ctx),
    ).toEqual({
      ok: true,
      value: { name: 'Amma', phone: '+919845012345', relation: 'Mother' },
    });
  });

  it('treats an empty relation as none', () => {
    const result = validateContact({ name: 'Ravi', phone: '9845012345', relation: '   ' }, ctx);
    expect(result.ok && result.value.relation).toBeNull();
  });

  it('reports every problem at once', () => {
    expect(validateContact({ name: ' ', phone: '123', relation: 'x'.repeat(31) }, ctx)).toEqual({
      ok: false,
      errors: {
        name: 'contacts.errors.nameRequired',
        phone: 'contacts.errors.phoneInvalid',
        relation: 'contacts.errors.relationTooLong',
      },
    });
  });

  it('rejects a name over 60 characters', () => {
    const result = validateContact(
      { name: 'a'.repeat(61), phone: '9845012345', relation: '' },
      ctx,
    );
    expect(result).toEqual({ ok: false, errors: { name: 'contacts.errors.nameTooLong' } });
  });

  it('rejects the user’s own number', () => {
    const result = validateContact({ name: 'Me', phone: '+91 99999 00001', relation: '' }, ctx);
    expect(result).toEqual({ ok: false, errors: { phone: 'contacts.errors.ownNumber' } });
  });

  it('rejects a number already in the list, however it was typed', () => {
    const result = validateContact(
      { name: 'Amma again', phone: '099000 00001', relation: '' },
      ctx,
    );
    expect(result).toEqual({ ok: false, errors: { phone: 'contacts.errors.duplicate' } });
  });
});

describe('canAddContact', () => {
  it('allows up to 5', () => {
    expect(canAddContact(0)).toBe(true);
    expect(canAddContact(4)).toBe(true);
    expect(canAddContact(5)).toBe(false);
  });
});
