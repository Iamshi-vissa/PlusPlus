import { fireEvent, render, screen } from '@testing-library/react-native';

import SignInScreen from '../app/sign-in';
import { sendOtp } from '@/features/auth/api';
import i18n from '@/i18n';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/features/auth/api', () => ({ sendOtp: jest.fn() }));
const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return { router: { push: (...args: unknown[]) => mockPush(...args) }, Link: Text };
});

const mockedSendOtp = jest.mocked(sendOtp);

describe('Sign-in screen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    mockedSendOtp.mockReset();
    mockPush.mockReset();
  });

  it('refuses a number that is not an Indian mobile, without calling the server', async () => {
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByTestId('phone-input'), '12345');
    await fireEvent.press(screen.getByTestId('send-code'));
    expect(screen.getByText('Enter a 10-digit Indian mobile number.')).toBeTruthy();
    expect(mockedSendOtp).not.toHaveBeenCalled();
  });

  it('sends the code to the +91 number and opens the code screen', async () => {
    mockedSendOtp.mockResolvedValue({ ok: true });
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByTestId('phone-input'), '98765 43210');
    await fireEvent.press(screen.getByTestId('send-code'));
    expect(mockedSendOtp).toHaveBeenCalledWith('+919876543210');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/verify',
      params: { phone: '+919876543210' },
    });
  });

  it('shows a friendly error when sending fails', async () => {
    mockedSendOtp.mockResolvedValue({ ok: false, error: 'auth.errors.tooManyRequests' });
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByTestId('phone-input'), '9876543210');
    await fireEvent.press(screen.getByTestId('send-code'));
    expect(await screen.findByText(/Too many attempts/)).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
