import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { FollowUpPicker } from '../src/screens/LeadScreen';
import { currentLang } from '../src/auth';
import { t } from '../src/i18n';

jest.mock('../src/api', () => ({ api: {} }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }), useRoute: () => ({ params: {} }) }));

test('the follow-up can be any day and hour, as a viewing', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  await render(<FollowUpPicker onSave={onSave} />);
  expect(screen.queryByTestId('fu-picker')).toBeNull();
  await fireEvent.press(screen.getByTestId('fu-pick'));
  await fireEvent.press(screen.getByText('17:00'));
  await fireEvent.press(screen.getByText(t(currentLang(), 'fuViewing')));
  await fireEvent.press(screen.getByTestId('fu-save'));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  const { at, kind } = onSave.mock.calls[0][0];
  expect(kind).toBe('viewing');
  expect(at.getHours()).toBe(17);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  expect(at.getDate()).toBe(tomorrow.getDate());
});
