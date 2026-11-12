import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClientError } from '@wehdathub/shared';
import { AddUnitScreen } from '../src/screens/AddUnitScreen';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { unitEditFields: jest.fn(), saveUnitEdit: jest.fn(), unitPhotos: jest.fn(), unit: jest.fn() } }));
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn(), replace: jest.fn() }), useRoute: () => ({ params: { edit: 'A-1' } }) }));
jest.mock('../src/voice', () => ({ ensureMic: jest.fn(), startRecording: jest.fn(), stopRecording: jest.fn(), cancelRecording: jest.fn() }));
const m = api as unknown as Record<string, jest.Mock>;

test('when the photos fail after the details saved, a second Save retries only the photos', async () => {
  m.unit.mockResolvedValue({ images: [{ id: 'i1', url: 'https://x.test/1.jpg', position: 0 }] });
  m.unitEditFields.mockResolvedValue({ code: 'A-1', version: 4, fields: { compound: 'Mivida' } });
  m.saveUnitEdit.mockResolvedValue({ code: 'A-1', version: 5 });
  m.unitPhotos.mockRejectedValueOnce(new ApiClientError(500, 'server_error')).mockResolvedValue({ images: [], failed: 0 });
  await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AddUnitScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTestId('photo-remove-0')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('photo-remove-0'));
  await fireEvent.press(screen.getByTestId('save-unit'));
  await waitFor(() => expect(screen.getByTestId('unit-error')).toBeTruthy());
  expect(mockGoBack).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('save-unit'));
  await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  expect(m.saveUnitEdit).toHaveBeenCalledTimes(1);
  expect(m.unitPhotos).toHaveBeenCalledTimes(2);
});
