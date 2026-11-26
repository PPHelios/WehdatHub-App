import React from 'react';
import { Alert, Linking } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../src/screens/LoginScreen';
import { api } from '../src/api';

jest.mock('../src/api', () => ({
  api: {
    trialOptions: jest.fn(),
    signup: jest.fn(),
    requestCode: jest.fn(),
    verifyCode: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.trialOptions.mockResolvedValue({
    enabled: true,
    waAvailable: true,
    tiers: {
      solo: { enabled: true, days: 14, credits: 80, seats: 1, units: 50 },
      team: { enabled: true, days: 14, credits: 200, seats: 5, units: 50 },
    },
  });
});

test('switches to Start Free Trial, shows dynamic tiers & Telegram pitch, and warns before WhatsApp fallback', async () => {
  mockedApi.signup.mockResolvedValue({
    ok: true,
    channel: 'whatsapp',
    verifyUrl: 'https://wa.me/201099990000?text=VERIFY%20su_abc',
    phone: '+201012345678',
    codeMinutes: 10,
  });
  const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
  const alertSpy = jest.spyOn(Alert, 'alert');

  await render(<LoginScreen />);
  const startBtn = await screen.findByTestId('mode-signup');
  fireEvent.press(startBtn);

  expect(await screen.findByTestId('tg-pitch-card')).toBeTruthy();
  expect(screen.getByTestId('tier-solo')).toBeTruthy();
  expect(screen.getByTestId('tier-team')).toBeTruthy();

  await fireEvent.changeText(screen.getByTestId('signup-name'), 'Kareem');
  await fireEvent.changeText(screen.getByTestId('phone-input'), '01012345678');
  await fireEvent.press(screen.getByTestId('signup-whatsapp'));

  expect(alertSpy).toHaveBeenCalled();
  const buttons = alertSpy.mock.calls[0][2] as Array<{ text?: string; onPress?: () => void }>;
  const proceed = buttons[buttons.length - 1];
  await proceed.onPress?.();

  await waitFor(() => expect(mockedApi.signup).toHaveBeenCalledWith({
    name: 'Kareem',
    phone: '01012345678',
    agency: undefined,
    tier: 'solo',
    channel: 'whatsapp',
    lang: 'ar',
  }));
  await waitFor(() => expect(openSpy).toHaveBeenCalledWith('https://wa.me/201099990000?text=VERIFY%20su_abc'));
  expect(screen.getByTestId('code-input')).toBeTruthy();
});
