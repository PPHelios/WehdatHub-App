import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClientError } from '@wehdathub/shared';
import { AddUnitScreen } from '../src/screens/AddUnitScreen';
import { api } from '../src/api';
import * as draft from '../src/draft';

jest.mock('../src/api', () => ({ api: { extractUnit: jest.fn(), reviewUnit: jest.fn(), createUnit: jest.fn() } }));
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ replace: mockReplace }), useRoute: () => ({ params: undefined }) }));
jest.mock('../src/voice', () => ({ ensureMic: jest.fn().mockResolvedValue(true), startRecording: jest.fn(), stopRecording: jest.fn(), cancelRecording: jest.fn() }));
const m = api as unknown as { extractUnit: jest.Mock; reviewUnit: jest.Mock; createUnit: jest.Mock };

const wrap = () => render(<QueryClientProvider client={new QueryClient()}><AddUnitScreen /></QueryClientProvider>);
beforeEach(async () => {
  jest.clearAllMocks();
  await draft.clearDraft();
});

test('a pasted message fills the fields', async () => {
  m.extractUnit.mockResolvedValue({ fields: { property_type: 'apartment', bedrooms: '3', area_value: '150' } });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('describe'), 'شقة 3 غرف');
  await fireEvent.press(screen.getByTestId('fill'));
  await waitFor(() => expect(screen.getByTestId('f-bedrooms').props.value).toBe('3'));
});

test('saving an incomplete unit lists what is missing and keeps the form', async () => {
  m.createUnit.mockRejectedValue(new ApiClientError(422, 'incomplete'));
  m.reviewUnit.mockResolvedValue({ ok: false, blockers: [{ field: 'area_value', label: 'Area' }], warnings: [], duplicate: null });
  await wrap();
  await fireEvent.press(screen.getByTestId('save-unit'));
  await waitFor(() => expect(screen.getByTestId('blockers')).toBeTruthy());
  expect(mockReplace).not.toHaveBeenCalled();
});

test('a duplicate asks before saving again', async () => {
  m.createUnit.mockRejectedValueOnce(new ApiClientError(409, 'duplicate'));
  m.reviewUnit.mockResolvedValue({ ok: true, blockers: [], warnings: [], duplicate: 'NH-V12' });
  m.createUnit.mockResolvedValueOnce({ code: 'NH-V13', photos: 0, photosFailed: 0 });
  await wrap();
  await fireEvent.press(screen.getByTestId('save-unit'));
  await waitFor(() => expect(screen.getByTestId('duplicate')).toBeTruthy());
  await fireEvent.press(screen.getByText(/Save anyway|احفظ برضه/));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('Unit', { code: 'NH-V13' }));
  expect(m.createUnit.mock.calls[1][0]).toMatchObject({ force: '1' });
});

test('a saved draft comes back when the screen opens again', async () => {
  await draft.saveDraft({ fields: { listing_type: 'rent', compound: 'Mivida' }, photos: [], describe: 'x', photoAi: false });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('f-compound').props.value).toBe('Mivida'));
  expect(screen.getByTestId('unit-notice')).toBeTruthy();
});
