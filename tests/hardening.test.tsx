import { render, screen } from '@testing-library/react-native';

import { CrashScreen } from '@/components/CrashScreen';
import { OfflineBanner } from '@/components/OfflineBanner';
import i18n from '@/i18n';

let mockListener:
  ((s: { isConnected: boolean; isInternetReachable: boolean | null }) => void) | null = null;
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: (cb: typeof mockListener) => {
      mockListener = cb;
      return () => undefined;
    },
  },
}));

describe('safety nets', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('keeps 108 / 112 on the crash screen', async () => {
    await render(<CrashScreen error={new Error('boom')} retry={async () => undefined} />);
    expect(screen.getByTestId('call-108')).toBeTruthy();
    expect(screen.getByTestId('call-112')).toBeTruthy();
  });

  it('shows an offline banner that says calls still work', async () => {
    await render(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).toBeNull();
    await screen.rerender(<OfflineBanner />);
    const { act } = require('@testing-library/react-native');
    await act(async () => mockListener?.({ isConnected: false, isInternetReachable: false }));
    expect(screen.getByTestId('offline-banner').props.children).toBe(
      "You're offline. Calls to 108 / 112 still work.",
    );
  });
});
