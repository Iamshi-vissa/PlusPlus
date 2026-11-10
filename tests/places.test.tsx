import { fireEvent, render, screen } from '@testing-library/react-native';

import FindCareScreen from '../app/(tabs)/explore';
import { uniqueParts } from '../app/clinic/[id]';
import { searchPlaces } from '@/features/places/api';
import {
  directionsUrl,
  formatDayHours,
  formatDistance,
  searchArgs,
  todayKey,
  widerRadius,
} from '@/features/places/format';
import { NO_FILTERS, type PlaceResult } from '@/features/places/types';
import i18n from '@/i18n';
import { getCurrentLocation } from '@/lib/location';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: () => true, getSupabase: jest.fn() }));
jest.mock('@/lib/location', () => ({ getCurrentLocation: jest.fn() }));
jest.mock('@/features/places/api', () => ({
  searchPlaces: jest.fn(),
  listDistricts: jest.fn().mockResolvedValue([]),
  listTaluks: jest.fn().mockResolvedValue([]),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Marker: View };
});

const place: PlaceResult = {
  id: 'p1',
  name_en: 'Sample City Hospital',
  name_kn: 'ಮಾದರಿ ಆಸ್ಪತ್ರೆ',
  type: 'hospital',
  address: null,
  pincode: '560001',
  phone: '+918000000000',
  district_name_en: 'Bengaluru Urban',
  district_name_kn: 'ಬೆಂಗಳೂರು ನಗರ',
  taluk_name_en: 'Bengaluru North',
  is_24x7: true,
  has_emergency: true,
  trauma_care: true,
  ownership: 'government',
  is_registered: false,
  specialities: ['emergency'],
  open_now: true,
  distance_m: 1234,
  lat: 12.97,
  lng: 77.59,
};

describe('format helpers', () => {
  it('drops repeated address parts', () => {
    expect(uniqueParts(['Sample address, Mysuru', 'Mysuru, Mysuru', '570001'])).toEqual([
      'Sample address',
      'Mysuru',
      '570001',
    ]);
  });

  it('formats distances', () => {
    expect(formatDistance(4)).toBe('10 m');
    expect(formatDistance(347)).toBe('350 m');
    expect(formatDistance(2440)).toBe('2.4 km');
    expect(formatDistance(18200)).toBe('18 km');
    expect(formatDistance(null)).toBeNull();
  });

  it('builds a Google Maps directions link', () => {
    expect(directionsUrl(12.9716, 77.5946)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=12.971600,77.594600',
    );
  });

  it('finds today in India time', () => {
    // 2026-11-09 is a Monday; 20:00 UTC Monday is already Tuesday 01:30 in India.
    expect(todayKey(new Date('2026-11-09T05:00:00Z'))).toBe('mon');
    expect(todayKey(new Date('2026-11-09T20:00:00Z'))).toBe('tue');
  });

  it('formats a day of opening hours', () => {
    expect(
      formatDayHours(
        {
          mon: [
            ['09:00', '13:00'],
            ['17:00', '21:00'],
          ],
        },
        'mon',
      ),
    ).toBe('09:00–13:00, 17:00–21:00');
    expect(formatDayHours({ sun: [] }, 'sun')).toBeNull();
  });

  it('widens 5 → 10 → 20 → 50 km, then stops', () => {
    expect(widerRadius(5000)).toBe(10000);
    expect(widerRadius(20000)).toBe(50000);
    expect(widerRadius(50000)).toBeNull();
  });

  it('builds search arguments for each kind of area', () => {
    expect(searchArgs({ kind: 'near', lat: 1, lng: 2, radiusM: 5000 }, NO_FILTERS)).toMatchObject({
      p_lat: 1,
      p_lng: 2,
      p_radius_m: 5000,
      p_types: null,
      p_query: null,
    });
    expect(
      searchArgs(
        { kind: 'pincode', pincode: '560001' },
        { ...NO_FILTERS, types: ['clinic'], query: ' dental ' },
      ),
    ).toMatchObject({ p_pincode: '560001', p_types: ['clinic'], p_query: 'dental' });
  });
});

describe('Find care screen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    jest.mocked(searchPlaces).mockReset().mockResolvedValue([place]);
    jest.mocked(getCurrentLocation).mockReset();
  });

  it('searches near the user and shows results with badges', async () => {
    jest
      .mocked(getCurrentLocation)
      .mockResolvedValue({ ok: true, coords: { lat: 12.97, lng: 77.59 }, accuracyM: 10 });
    await render(<FindCareScreen />);
    await fireEvent.press(screen.getByTestId('near-me'));
    expect(await screen.findByText('Sample City Hospital')).toBeTruthy();
    expect(screen.getByText(/1.2 km away/)).toBeTruthy();
    expect(screen.getByText('Open 24×7')).toBeTruthy();
    expect(screen.getByText('Trauma care')).toBeTruthy();
    expect(jest.mocked(searchPlaces).mock.calls[0][0]).toEqual({
      kind: 'near',
      lat: 12.97,
      lng: 77.59,
      radiusM: 5000,
    });
  });

  it('does not search outside Karnataka', async () => {
    jest
      .mocked(getCurrentLocation)
      .mockResolvedValue({ ok: true, coords: { lat: 13.08, lng: 80.27 }, accuracyM: 10 });
    await render(<FindCareScreen />);
    await fireEvent.press(screen.getByTestId('near-me'));
    expect(
      await screen.findByText('plusplus is currently available only in Karnataka.'),
    ).toBeTruthy();
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  it('checks PIN codes before searching', async () => {
    await render(<FindCareScreen />);
    await fireEvent.press(screen.getByTestId('choose-pincode'));
    await fireEvent.changeText(screen.getByTestId('pincode-input'), '600001');
    await fireEvent.press(screen.getByTestId('pincode-search'));
    expect(screen.getByText(/Enter a Karnataka PIN code/)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('pincode-input'), '560001');
    await fireEvent.press(screen.getByTestId('pincode-search'));
    expect(await screen.findByText('1 places in 560001')).toBeTruthy();
  });

  it('applies filters', async () => {
    jest
      .mocked(getCurrentLocation)
      .mockResolvedValue({ ok: true, coords: { lat: 12.97, lng: 77.59 }, accuracyM: 10 });
    await render(<FindCareScreen />);
    await fireEvent.press(screen.getByTestId('near-me'));
    await screen.findByText('Sample City Hospital');
    await fireEvent.press(screen.getByTestId('filter-emergency'));
    await fireEvent.press(screen.getByTestId('type-hospital'));
    const last = jest.mocked(searchPlaces).mock.calls.at(-1)!;
    expect(last[1]).toMatchObject({ emergency: true, types: ['hospital'] });
  });

  it('shows Kannada names when the app is in Kannada', async () => {
    await i18n.changeLanguage('kn');
    jest
      .mocked(getCurrentLocation)
      .mockResolvedValue({ ok: true, coords: { lat: 12.97, lng: 77.59 }, accuracyM: 10 });
    await render(<FindCareScreen />);
    await fireEvent.press(screen.getByTestId('near-me'));
    expect(await screen.findByText('ಮಾದರಿ ಆಸ್ಪತ್ರೆ')).toBeTruthy();
  });
});
