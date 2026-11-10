import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import HomeScreen from '../app/(tabs)/index';
import i18n from '@/i18n';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/lib/location', () => ({ getCurrentLocation: jest.fn() }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

describe('Home screen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    jest.restoreAllMocks();
  });

  it('shows the SOS button and both emergency call buttons', async () => {
    await render(<HomeScreen />);
    expect(screen.getByTestId('sos-button')).toBeTruthy();
    expect(screen.getByText('Call 108')).toBeTruthy();
    expect(screen.getByText('Call 112')).toBeTruthy();
  });

  it('dials 108 and 112 with one tap', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(<HomeScreen />);
    await fireEvent.press(screen.getByTestId('call-108'));
    await fireEvent.press(screen.getByTestId('call-112'));
    expect(openURL).toHaveBeenCalledWith('tel:108');
    expect(openURL).toHaveBeenCalledWith('tel:112');
  });

  it('tells the user to dial by hand if the dialler cannot open', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no dialler'));
    await render(<HomeScreen />);
    await fireEvent.press(screen.getByTestId('call-108'));
    expect(await screen.findByText(/dial 108 yourself/)).toBeTruthy();
  });

  it('opens the SOS countdown and keeps the call buttons on screen', async () => {
    await render(<HomeScreen />);
    await fireEvent.press(screen.getByTestId('sos-button'));
    expect(mockPush).toHaveBeenCalledWith('/sos/new');
    expect(screen.getByTestId('call-108')).toBeTruthy();
    expect(screen.getByTestId('call-112')).toBeTruthy();
  });

  it('renders in Kannada', async () => {
    await i18n.changeLanguage('kn');
    await render(<HomeScreen />);
    expect(screen.getByText('108 ಗೆ ಕರೆ ಮಾಡಿ')).toBeTruthy();
  });
});
