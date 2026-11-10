import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import NewSosScreen from '../app/sos/new';
import { createSos } from '@/features/sos/api';
import i18n from '@/i18n';
import { getCurrentLocation } from '@/lib/location';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...a: unknown[]) => mockReplace(...a),
    back: () => mockBack(),
    push: jest.fn(),
  },
}));
jest.mock('@/lib/location', () => ({ getCurrentLocation: jest.fn() }));
jest.mock('@/features/sos/api', () => ({ createSos: jest.fn() }));
let mockSession: object | null = { user: { id: 'u1' } };
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ session: mockSession }) }));

describe('SOS countdown', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await i18n.changeLanguage('en');
    mockSession = { user: { id: 'u1' } };
    mockReplace.mockReset();
    mockBack.mockReset();
    jest.mocked(createSos).mockReset();
    jest
      .mocked(getCurrentLocation)
      .mockResolvedValue({ ok: true, coords: { lat: 12.97, lng: 77.59 }, accuracyM: 12 });
  });
  afterEach(() => jest.useRealTimers());

  it('always shows 108 and 112', async () => {
    await render(<NewSosScreen />);
    expect(screen.getByTestId('call-108')).toBeTruthy();
    expect(screen.getByTestId('call-112')).toBeTruthy();
  });

  it('counts down and sends after 5 seconds with the quick answers', async () => {
    jest.useRealTimers(); // the 1-second countdown runs on real time here
    jest.mocked(createSos).mockResolvedValue({ ok: true, id: 'sos-1' });
    await render(<NewSosScreen />);
    expect(screen.getByTestId('countdown').props.children).toBe('Sending SOS in 5…');
    await fireEvent.press(screen.getByTestId('conscious-no'));
    await waitFor(
      () =>
        expect(mockReplace).toHaveBeenCalledWith({
          pathname: '/sos/[id]',
          params: { id: 'sos-1' },
        }),
      {
        timeout: 8000,
      },
    );
    expect(createSos).toHaveBeenCalledWith(
      12.97,
      77.59,
      12,
      expect.objectContaining({ isConscious: false }),
    );
  }, 10000);

  it('Cancel stops an accidental SOS', async () => {
    await render(<NewSosScreen />);
    await fireEvent.press(screen.getByTestId('sos-cancel'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('without internet, tells the person to call 108 / 112 (buttons still there)', async () => {
    jest.mocked(createSos).mockResolvedValue({ ok: false, error: 'network' });
    await render(<NewSosScreen />);
    await fireEvent.press(screen.getByTestId('sos-send-now'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByTestId('sos-error').props.children).toMatch(/Call 108 or 112 now/);
    expect(screen.getByTestId('call-108')).toBeTruthy();
  });

  it('signed out: explains and still offers 108 / 112', async () => {
    mockSession = null;
    await render(<NewSosScreen />);
    await fireEvent.press(screen.getByTestId('sos-send-now'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByTestId('sos-error').props.children).toMatch(/Sign in/);
    expect(createSos).not.toHaveBeenCalled();
    expect(screen.getByTestId('call-112')).toBeTruthy();
  });
});
