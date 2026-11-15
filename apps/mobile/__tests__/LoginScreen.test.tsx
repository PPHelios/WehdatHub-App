import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiClientError } from '@wehdathub/shared';
import { LoginScreen } from '../src/screens/LoginScreen';
import { api } from '../src/api';
import { useAuth } from '../src/auth';

jest.mock('../src/api', () => ({ api: { requestCode: jest.fn(), verifyCode: jest.fn() } }));
const mocked = api as unknown as { requestCode: jest.Mock; verifyCode: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.setState({ status: 'signedOut', token: null, broker: null, agencyName: null });
});

test('a bad phone is refused before any call', async () => {
  await render(<LoginScreen />);
  await fireEvent.changeText(screen.getByTestId('phone-input'), '12');
  await fireEvent.press(screen.getByTestId('send-code'));
  expect(mocked.requestCode).not.toHaveBeenCalled();
  expect(screen.getByTestId('login-message')).toBeTruthy();
});

test('phone, then code, signs in and stores the session', async () => {
  mocked.requestCode.mockResolvedValue({ ok: true, codeMinutes: 5 });
  mocked.verifyCode.mockResolvedValue({ token: 'tok_tok_tok_tok_tok_tok', expiresAt: '2030-01-01', broker: { id: 'b1', name: 'Hana', role: 'broker', lang: 'ar' }, agency: { id: 'a1', name: 'NCH', slug: 'nch', logoUrl: null } });
  await render(<LoginScreen />);
  await fireEvent.changeText(screen.getByTestId('phone-input'), '01012345678');
  await fireEvent.press(screen.getByTestId('send-code'));
  await waitFor(() => expect(screen.getByTestId('code-input')).toBeTruthy());
  expect(mocked.requestCode).toHaveBeenCalledWith('01012345678');
  await fireEvent.changeText(screen.getByTestId('code-input'), '123456');
  await fireEvent.press(screen.getByTestId('verify'));
  await waitFor(() => expect(useAuth.getState().status).toBe('signedIn'));
  expect(mocked.verifyCode).toHaveBeenCalledWith('01012345678', '123456');
  expect(useAuth.getState().agencyName).toBe('NCH');
});

test('a wrong code shows a plain message and keeps the form usable', async () => {
  mocked.requestCode.mockResolvedValue({ ok: true, codeMinutes: 5 });
  mocked.verifyCode.mockRejectedValue(new ApiClientError(401, 'invalid_code'));
  await render(<LoginScreen />);
  await fireEvent.changeText(screen.getByTestId('phone-input'), '01012345678');
  await fireEvent.press(screen.getByTestId('send-code'));
  await waitFor(() => screen.getByTestId('code-input'));
  await fireEvent.changeText(screen.getByTestId('code-input'), '123456');
  await fireEvent.press(screen.getByTestId('verify'));
  await waitFor(() => expect(screen.getByTestId('login-message').props.children).toMatch(/الكود/));
  expect(useAuth.getState().status).toBe('signedOut');
  expect(screen.queryByTestId('button-spinner')).toBeNull();
});

test('leaving the phone field with a wrong number shows the note at once, and a good number shows none', async () => {
  await render(<LoginScreen />);
  await fireEvent.changeText(screen.getByTestId('phone-input'), '12');
  await fireEvent(screen.getByTestId('phone-input'), 'blur');
  expect(screen.getByTestId('login-message')).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId('phone-input'), '01012345678');
  expect(screen.queryByTestId('login-message')).toBeNull();
  expect(screen.getByTestId('logo')).toBeTruthy();
});
