import { osmToPlace, parseOpeningHours } from '../scripts/places/osm';

describe('parseOpeningHours', () => {
  it('reads 24/7', () => {
    expect(parseOpeningHours('24/7')).toEqual({ hours: null, is24x7: true });
  });

  it('reads split shifts and closed days', () => {
    const { hours } = parseOpeningHours('Mo-Sa 09:00-13:00,17:00-21:00; Su off');
    expect(hours?.mon).toEqual([
      ['09:00', '13:00'],
      ['17:00', '21:00'],
    ]);
    expect(hours?.sat).toEqual(hours?.mon);
    expect(hours?.sun).toEqual([]);
  });

  it('reads day lists and single-digit hours', () => {
    const { hours } = parseOpeningHours('Mo,We,Fr 9:00-17:00; Sa 10:00-24:00');
    expect(hours?.mon).toEqual([['09:00', '17:00']]);
    expect(hours?.tue).toEqual([]);
    expect(hours?.sat).toEqual([['10:00', '23:59']]);
  });

  it('gives up (unknown) on forms it does not understand', () => {
    expect(parseOpeningHours('sunrise-sunset').hours).toBeNull();
    expect(parseOpeningHours('Mo-Fr 09:00-17:00; PH off').hours).toBeNull();
    expect(parseOpeningHours(undefined).hours).toBeNull();
  });
});

describe('osmToPlace', () => {
  it('maps a government hospital with emergency', () => {
    expect(
      osmToPlace({
        type: 'way',
        id: 42,
        center: { lat: 12.95, lon: 77.57 },
        tags: {
          amenity: 'hospital',
          name: 'Victoria Hospital',
          'name:kn': 'ವಿಕ್ಟೋರಿಯಾ ಆಸ್ಪತ್ರೆ',
          'operator:type': 'government',
          emergency: 'yes',
          opening_hours: '24/7',
          phone: '080 2670 1150',
          'addr:postcode': '560002',
        },
      }),
    ).toMatchObject({
      sourceId: 'way/42',
      type: 'hospital',
      ownership: 'government',
      name_kn: 'ವಿಕ್ಟೋರಿಯಾ ಆಸ್ಪತ್ರೆ',
      is_24x7: true,
      has_emergency: true,
      phone: '+918026701150',
      pincode: '560002',
      lat: 12.95,
      lng: 77.57,
    });
  });

  it('maps dentists and pharmacies', () => {
    expect(
      osmToPlace({
        type: 'node',
        id: 1,
        lat: 12,
        lon: 77,
        tags: { amenity: 'dentist', name: 'Smile' },
      }),
    ).toMatchObject({ type: 'clinic', specialities: ['dental'] });
    expect(
      osmToPlace({
        type: 'node',
        id: 2,
        lat: 12,
        lon: 77,
        tags: { amenity: 'pharmacy', name: 'Apollo Pharmacy' },
      }),
    ).toMatchObject({ type: 'medical_store' });
  });

  it('skips unnamed or non-health features', () => {
    expect(
      osmToPlace({ type: 'node', id: 3, lat: 12, lon: 77, tags: { amenity: 'hospital' } }),
    ).toBeNull();
    expect(
      osmToPlace({
        type: 'node',
        id: 4,
        lat: 12,
        lon: 77,
        tags: { amenity: 'school', name: 'X School' },
      }),
    ).toBeNull();
  });

  it('ignores PIN codes from outside Karnataka and bad phone numbers', () => {
    const p = osmToPlace({
      type: 'node',
      id: 5,
      lat: 12,
      lon: 77,
      tags: {
        amenity: 'clinic',
        name: 'Border Clinic',
        'addr:postcode': '600001',
        phone: 'call us',
      },
    });
    expect(p?.pincode).toBeNull();
    expect(p?.phone).toBeNull();
  });
});
