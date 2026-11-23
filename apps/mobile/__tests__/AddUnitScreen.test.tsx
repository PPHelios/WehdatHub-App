import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClientError, COLORS } from '@wehdathub/shared';
import { AddUnitScreen } from '../src/screens/AddUnitScreen';
import { api } from '../src/api';
import * as draft from '../src/draft';
import { greenGradient } from '../src/theme';
import { usePrefs } from '../src/prefs';

jest.mock('../src/api', () => ({ api: { extractUnit: jest.fn(), reviewUnit: jest.fn(), createUnit: jest.fn(), placeBox: jest.fn(), placeBoxResolve: jest.fn(), placeSuggest: jest.fn() } }));
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ replace: mockReplace }), useRoute: () => ({ params: undefined }) }));
jest.mock('../src/voice', () => ({ ensureMic: jest.fn().mockResolvedValue(true), startRecording: jest.fn(), stopRecording: jest.fn(), cancelRecording: jest.fn() }));
const m = api as unknown as { extractUnit: jest.Mock; reviewUnit: jest.Mock; createUnit: jest.Mock; placeBox: jest.Mock };

const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AddUnitScreen /></QueryClientProvider>);
beforeEach(async () => {
  jest.clearAllMocks();
  m.reviewUnit.mockResolvedValue({ ok: true, blockers: [], warnings: [], duplicate: null });
  await draft.clearDraft();
});
afterEach(() => usePrefs.setState({ appearance: 'system' }));

test('a pasted message fills the fields', async () => {
  m.extractUnit.mockResolvedValue({ fields: { property_type: 'apartment', bedrooms: '3', area_value: '150' } });
  await draft.saveDraft({ fields: { listing_type: 'sale', compound: 'Mivida' }, photos: [], describe: '', photoAi: false });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('describe'), 'شقة 3 غرف');
  await fireEvent.press(screen.getByTestId('fill'));
  await waitFor(() => expect(screen.getByTestId('f-bedrooms').props.value).toBe('3'));
});

test('with AI credits used up, the quick reader still fills the fields and says so', async () => {
  m.extractUnit.mockRejectedValue(new ApiClientError(402, 'ai_blocked', null, { error: 'ai_blocked', fallback: true, message: 'Credits are used up. The quick reader filled what it could: check every field.', fields: { property_type: 'apartment', bedrooms: '3' } }));
  await draft.saveDraft({ fields: { listing_type: 'sale', compound: 'Mivida' }, photos: [], describe: '', photoAi: false });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('describe'), 'شقة 3 غرف');
  await fireEvent.press(screen.getByTestId('fill'));
  await waitFor(() => expect(screen.getByTestId('f-bedrooms').props.value).toBe('3'));
  expect(screen.getByText(/quick reader filled/)).toBeTruthy();
});

test('review blockers list what is missing and disable saving until corrected', async () => {
  m.reviewUnit.mockResolvedValue({ ok: false, blockers: [{ field: 'area_value', label: 'Area' }], warnings: [], duplicate: null });
  await draft.saveDraft({ fields: { listing_type: 'sale', compound: 'Mivida' }, photos: [], describe: '', photoAi: false });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('blockers')).toBeTruthy());
  expect(screen.getByText('• Area')).toBeTruthy();
  expect(screen.getByTestId('save-unit')).toBeDisabled();
  expect(m.createUnit).not.toHaveBeenCalled();
  m.reviewUnit.mockResolvedValue({ ok: true, blockers: [], warnings: [], duplicate: null });
  await fireEvent.changeText(screen.getByTestId('f-area_value'), '150');
  await waitFor(() => expect(screen.getByTestId('save-unit')).toBeEnabled());
});

test('warnings require acknowledgement, and changing the form clears it', async () => {
  m.reviewUnit.mockResolvedValue({ ok: true, blockers: [], warnings: [{ field: 'price_value', text: 'Check the price' }], duplicate: null });
  await draft.saveDraft({ fields: { listing_type: 'sale', compound: 'Mivida' }, photos: [], describe: '', photoAi: false });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('warnings')).toBeTruthy());
  expect(screen.getByTestId('save-unit')).toBeDisabled();
  await fireEvent(screen.getByTestId('ack'), 'valueChange', true);
  expect(screen.getByTestId('save-unit')).toBeEnabled();
  await fireEvent.changeText(screen.getByTestId('f-price_value'), '9500000');
  await waitFor(() => expect(screen.getByTestId('warnings')).toBeTruthy());
  expect(screen.getByTestId('save-unit')).toBeDisabled();
});

test('a duplicate asks before saving again', async () => {
  m.createUnit.mockRejectedValueOnce(new ApiClientError(409, 'duplicate'));
  m.reviewUnit.mockResolvedValueOnce({ ok: true, blockers: [], warnings: [], duplicate: null });
  m.reviewUnit.mockResolvedValue({ ok: true, blockers: [], warnings: [], duplicate: 'NH-V12' });
  m.createUnit.mockResolvedValueOnce({ code: 'NH-V13', photos: 0, photosFailed: 0 });
  await draft.saveDraft({ fields: { listing_type: 'sale', compound: 'Mivida' }, photos: [], describe: '', photoAi: false });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('save-unit')).toBeEnabled());
  await fireEvent.press(screen.getByTestId('save-unit'));
  await waitFor(() => expect(screen.getByTestId('duplicate')).toBeTruthy());
  await fireEvent.press(screen.getByText(/Save anyway|احفظ برضه/));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('Unit', { code: 'NH-V13' }));
  expect(m.createUnit.mock.calls[1][0]).toMatchObject({ force: '1' });
});

test('a saved draft comes back when the screen opens again, with its place as the chip', async () => {
  await draft.saveDraft({ fields: { listing_type: 'rent', compound: 'Mivida' }, photos: [], describe: 'x', photoAi: false });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('ubox-place')).toBeTruthy());
  expect(screen.getByText(/Mivida/)).toBeTruthy();
  expect(screen.getByTestId('unit-notice')).toBeTruthy();
});

test('a sale shows all form sections on one page without section shortcuts', async () => {
  await wrap();
  expect(screen.queryByTestId('step-next')).toBeNull();
  expect(screen.getByTestId('f-price_value')).toBeTruthy(); // size and price
  expect(screen.getByTestId('f-delivery_year')).toBeTruthy(); // a sale has delivery and payment
  expect(screen.queryByTestId('jump-3')).toBeNull();
  expect(screen.getByTestId('f-owner_phone')).toBeTruthy(); // owner
});

test.each(['light', 'dark'] as const)('currency chips switch from muted to green without layout animation in %s mode', async (appearance) => {
  usePrefs.setState({ appearance });
  await wrap();
  const usd = () => screen.getByRole('button', { name: 'USD' });
  expect(StyleSheet.flatten(usd().props.style)).toMatchObject({ backgroundColor: COLORS[appearance].soft, borderColor: COLORS[appearance].line });
  expect(StyleSheet.flatten(screen.getByText('USD').props.style).color).toBe(COLORS[appearance].muted);
  expect(usd().props.onLayout).toBeUndefined();
  await fireEvent.press(usd());
  expect(StyleSheet.flatten(usd().props.style)).toMatchObject(greenGradient);
  expect(usd().props.accessibilityState.selected).toBe(true);
});

test('a rental omits delivery and payment but retains the owner section', async () => {
  await draft.saveDraft({ fields: { listing_type: 'rent' }, photos: [], describe: '', photoAi: false });
  await wrap();
  await waitFor(() => expect(screen.queryByTestId('f-delivery_year')).toBeNull());
  expect(screen.getByTestId('f-owner_phone')).toBeTruthy();
});

test('the code comes right after the place picker, before sale or rent', async () => {
  await wrap();
  const tree = JSON.stringify(screen.toJSON());
  const at = (id: string) => tree.indexOf(id);
  expect(at('unit-box-input')).toBeGreaterThan(-1);
  expect(screen.queryByTestId('jump-1')).toBeNull();
  expect(at('unit-box-input')).toBeLessThan(at('f-code'));
  expect(at('f-code')).toBeLessThan(at('f-listing_type'));
});

test('the client description is written from the unit fields while nobody has typed in it', async () => {
  await draft.saveDraft({ fields: { listing_type: 'sale', compound: 'Mivida', property_type: 'apartment', bedrooms: '3', area_value: '150' }, photos: [], describe: '', photoAi: false });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('clean-summary').props.value).toMatch(/3 (bedrooms|غرف)/));
});

test('without a place, the form explains the requirement and disables save', async () => {
  m.reviewUnit.mockResolvedValue({ ok: true, blockers: [], warnings: [], duplicate: null });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('blockers')).toBeTruthy());
  expect(screen.getByTestId('save-unit')).toBeDisabled();
  expect(screen.getByText(/Pick a place from the list|اختار مكان من القايمة/)).toBeTruthy();
  expect(m.createUnit).not.toHaveBeenCalled();
});

test('a place picked in the box lets the save through', async () => {
  m.reviewUnit.mockResolvedValue({ ok: true, blockers: [], warnings: [], duplicate: null });
  m.createUnit.mockResolvedValue({ code: 'NH-V14', photos: 0, photosFailed: 0 });
  await draft.saveDraft({ fields: { listing_type: 'sale', area_id: 'a1', place_label: 'New Cairo' }, photos: [], describe: '', photoAi: false });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('save-unit')).toBeEnabled());
  await fireEvent.press(screen.getByTestId('save-unit'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('Unit', { code: 'NH-V14' }));
});
