import { checkInKarnataka, isInKarnataka, isKarnatakaPincode } from '@/lib/geo/karnataka';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }),
}));

const cities = {
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  mysuru: { lat: 12.2958, lng: 76.6394 },
  hubballi: { lat: 15.3647, lng: 75.124 },
  mangaluru: { lat: 12.8703, lng: 74.8423 },
  belagavi: { lat: 15.8497, lng: 74.4977 },
  bidar: { lat: 17.9104, lng: 77.5199 },
  kalaburagi: { lat: 17.3297, lng: 76.8343 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  panaji: { lat: 15.4909, lng: 73.8278 },
  hosur: { lat: 12.7409, lng: 77.8253 },
  kasaragod: { lat: 12.4996, lng: 74.9869 },
  kolhapur: { lat: 16.705, lng: 74.2433 },
  mumbai: { lat: 19.076, lng: 72.8777 },
};

describe('checkInKarnataka (offline)', () => {
  it.each([
    'bengaluru',
    'mysuru',
    'hubballi',
    'mangaluru',
    'belagavi',
    'bidar',
    'kalaburagi',
  ] as const)('%s is inside', (city) => {
    expect(checkInKarnataka(cities[city])).toBe('inside');
  });

  it.each(['chennai', 'hyderabad', 'panaji', 'hosur', 'kasaragod', 'kolhapur', 'mumbai'] as const)(
    '%s is outside',
    (city) => {
      expect(checkInKarnataka(cities[city])).toBe('outside');
    },
  );

  it('is unsure right at the border (Attibele / Hosur checkpost)', () => {
    expect(checkInKarnataka({ lat: 12.7795, lng: 77.7712 })).toBe('near_border');
  });

  it('treats invalid coordinates as outside', () => {
    expect(checkInKarnataka({ lat: Number.NaN, lng: 77 })).toBe('outside');
    expect(checkInKarnataka({ lat: 95, lng: 77 })).toBe('outside');
  });
});

describe('isInKarnataka', () => {
  beforeEach(() => mockRpc.mockReset());

  it('answers certain cases without the server', async () => {
    await expect(isInKarnataka(cities.bengaluru)).resolves.toBe(true);
    await expect(isInKarnataka(cities.chennai)).resolves.toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('asks the server near the border', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    await expect(isInKarnataka({ lat: 12.7795, lng: 77.7712 })).resolves.toBe(false);
    expect(mockRpc).toHaveBeenCalledWith('is_in_karnataka', { lat: 12.7795, lng: 77.7712 });
  });

  it('never blocks someone near the border when the server is unreachable', async () => {
    mockRpc.mockRejectedValue(new Error('offline'));
    await expect(isInKarnataka({ lat: 12.7795, lng: 77.7712 })).resolves.toBe(true);
  });
});

describe('isKarnatakaPincode', () => {
  it.each(['560001', '570001', '580020', '591201', '560 034'])('accepts %s', (pin) => {
    expect(isKarnatakaPincode(pin)).toBe(true);
  });
  it.each(['600001', '500001', '403001', '56001', '5600011', 'abcdef', ''])('rejects %s', (pin) => {
    expect(isKarnatakaPincode(pin)).toBe(false);
  });
});
