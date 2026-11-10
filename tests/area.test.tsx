import { fireEvent, render, screen } from '@testing-library/react-native';

import { describeArea, localName } from '@/features/location/area';
import { AreaCard } from '@/features/location/AreaCard';
import i18n from '@/i18n';
import { getCurrentLocation } from '@/lib/location';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/location', () => ({ getCurrentLocation: jest.fn() }));
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({ rpc: (...a: unknown[]) => ({ returns: () => mockRpc(...a) }) }),
}));

const mockedLocation = jest.mocked(getCurrentLocation);
const MYSURU = { lat: 12.2958, lng: 76.6394 };
const CHENNAI = { lat: 13.0827, lng: 80.2707 };
const mysuruRow = {
  district_id: 22,
  district_name_en: 'Mysuru',
  district_name_kn: 'ಮೈಸೂರು',
  taluk_id: 140,
  taluk_name_en: 'Mysuru',
  taluk_name_kn: null,
};

beforeEach(async () => {
  await i18n.changeLanguage('en');
  mockRpc.mockReset();
  mockedLocation.mockReset();
});

describe('describeArea', () => {
  it('returns the district and taluk inside Karnataka', async () => {
    mockRpc.mockResolvedValue({ data: [mysuruRow], error: null });
    await expect(describeArea(MYSURU)).resolves.toEqual({
      status: 'inside',
      district: { id: 22, en: 'Mysuru', kn: 'ಮೈಸೂರು' },
      taluk: { id: 140, en: 'Mysuru', kn: null },
    });
  });

  it('says outside without asking the server', async () => {
    await expect(describeArea(CHENNAI)).resolves.toEqual({ status: 'outside' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('still says inside when the server is unreachable', async () => {
    mockRpc.mockRejectedValue(new Error('offline'));
    await expect(describeArea(MYSURU)).resolves.toEqual({ status: 'inside' });
  });
});

describe('localName', () => {
  it('uses Kannada when available, else English', () => {
    expect(localName({ en: 'Mysuru', kn: 'ಮೈಸೂರು' }, 'kn')).toBe('ಮೈಸೂರು');
    expect(localName({ en: 'Mysuru', kn: null }, 'kn')).toBe('Mysuru');
    expect(localName({ en: 'Mysuru', kn: 'ಮೈಸೂರು' }, 'en')).toBe('Mysuru');
  });
});

describe('AreaCard', () => {
  it('shows taluk and district after "Use my location"', async () => {
    mockedLocation.mockResolvedValue({ ok: true, coords: MYSURU, accuracyM: 20 });
    mockRpc.mockResolvedValue({ data: [mysuruRow], error: null });
    await render(<AreaCard />);
    await fireEvent.press(screen.getByTestId('use-location'));
    expect(await screen.findByText('Mysuru, Mysuru district')).toBeTruthy();
  });

  it('shows the district in Kannada', async () => {
    await i18n.changeLanguage('kn');
    mockedLocation.mockResolvedValue({ ok: true, coords: MYSURU, accuracyM: 20 });
    mockRpc.mockResolvedValue({ data: [mysuruRow], error: null });
    await render(<AreaCard />);
    await fireEvent.press(screen.getByTestId('use-location'));
    expect(await screen.findByText('Mysuru, ಮೈಸೂರು ಜಿಲ್ಲೆ')).toBeTruthy();
  });

  it('politely says plusplus is only in Karnataka', async () => {
    mockedLocation.mockResolvedValue({ ok: true, coords: CHENNAI, accuracyM: 20 });
    await render(<AreaCard />);
    await fireEvent.press(screen.getByTestId('use-location'));
    expect(
      await screen.findByText('plusplus is currently available only in Karnataka.'),
    ).toBeTruthy();
  });

  it('explains when location permission is off', async () => {
    mockedLocation.mockResolvedValue({ ok: false, reason: 'denied' });
    await render(<AreaCard />);
    await fireEvent.press(screen.getByTestId('use-location'));
    expect(await screen.findByText(/Location permission is off/)).toBeTruthy();
  });
});
