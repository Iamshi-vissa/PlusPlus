import {
  distanceM,
  isLicenceNumber,
  normalizeVehicleNumber,
  shouldSend,
  smooth,
  type Fix,
} from '@/features/responder/locationRules';

const fix = (lat: number, lng: number, at: number, accuracyM = 10): Fix => ({
  lat,
  lng,
  at,
  accuracyM,
});

describe('location rules', () => {
  it('measures distance', () => {
    expect(distanceM({ lat: 12.9716, lng: 77.5946 }, { lat: 12.9716, lng: 77.5946 })).toBe(0);
    // ~1.1 km per 0.01° latitude
    expect(distanceM({ lat: 12.97, lng: 77.59 }, { lat: 12.98, lng: 77.59 })).toBeGreaterThan(1100);
    expect(distanceM({ lat: 12.97, lng: 77.59 }, { lat: 12.98, lng: 77.59 })).toBeLessThan(1120);
  });

  it('drops fixes worse than 100 m', () => {
    expect(shouldSend(null, fix(12.97, 77.59, 0, 150), false)).toBe(false);
    expect(smooth([fix(12.97, 77.59, 0, 500)])).toBeNull();
  });

  it('averages the last 3 good fixes', () => {
    const s = smooth([
      fix(0, 0, 0),
      fix(12, 77, 1),
      fix(13, 78, 2),
      fix(14, 79, 3),
      fix(99, 99, 4, 300),
    ]);
    expect(s).toEqual({ lat: 13, lng: 78, accuracyM: 10, at: 3 });
  });

  it('sends every 30 s while available', () => {
    const last = fix(12.97, 77.59, 0);
    expect(shouldSend(last, fix(12.97, 77.59, 29000), false)).toBe(false);
    expect(shouldSend(last, fix(12.97, 77.59, 30000), false)).toBe(true);
  });

  it('sends sooner after moving 100 m', () => {
    expect(shouldSend(fix(12.97, 77.59, 0), fix(12.971, 77.59, 5000), false)).toBe(true); // ~111 m
  });

  it('sends every 5 s during an active SOS', () => {
    const last = fix(12.97, 77.59, 0);
    expect(shouldSend(last, fix(12.97, 77.59, 4000), true)).toBe(false);
    expect(shouldSend(last, fix(12.97, 77.59, 5000), true)).toBe(true);
  });
});

describe('vehicle and licence numbers', () => {
  it.each([
    ['KA 01 AB 1234', 'KA01AB1234'],
    ['ka-05-mx-0042', 'KA05MX0042'],
    ['KA51E4321', 'KA51E4321'],
  ])('accepts %s', (input, out) => {
    expect(normalizeVehicleNumber(input)).toBe(out);
  });
  it.each(['1234', 'KARNATAKA', 'K01AB1234', ''])('rejects %s', (input) => {
    expect(normalizeVehicleNumber(input)).toBeNull();
  });
  it('checks licence number shape', () => {
    expect(isLicenceNumber('KA01 20230001234')).toBe(true);
    expect(isLicenceNumber('KA-0120230001234')).toBe(true);
    expect(isLicenceNumber('12345')).toBe(false);
  });
});
