import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClientError } from '@wehdathub/shared';
import { AddUnitScreen } from '../src/screens/AddUnitScreen';
import { UnitScreen } from '../src/screens/UnitScreen';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { unitEditFields: jest.fn(), saveUnitEdit: jest.fn(), unit: jest.fn(), unitContact: jest.fn(), unitAccessRequest: jest.fn(), unitShareLink: jest.fn(), reviewUnit: jest.fn().mockResolvedValue({ ok: true, blockers: [], warnings: [], duplicate: null }) } }));
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
let mockParams: object | undefined = { edit: 'A-1' };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, replace: jest.fn() }), useRoute: () => ({ params: mockParams }) }));
jest.mock('../src/voice', () => ({ ensureMic: jest.fn(), startRecording: jest.fn(), stopRecording: jest.fn(), cancelRecording: jest.fn() }));
const m = api as unknown as Record<string, jest.Mock>;

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const unit = { id: 'u1', code: 'A-1', status: 'active', compound: 'Mivida', price: 9000000, bedrooms: 3, bathrooms: 2, area: 150, district: null, city: null, finishing: null, furnishing: null, features: [], images: [] };

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { edit: 'A-1' };
});

test('edit mode loads the unit, saves with its version and goes back', async () => {
  m.unit.mockResolvedValue({ images: [] });
  m.unitEditFields.mockResolvedValue({ code: 'A-1', version: 4, fields: { compound: 'Mivida', price_value: '9000000' } });
  m.saveUnitEdit.mockResolvedValue({ code: 'A-1', version: 5 });
  await render(<QueryClientProvider client={client()}><AddUnitScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText(/Mivida/)).toBeTruthy());
  expect(screen.getByTestId('add-photos')).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId('f-price_value'), '8500000');
  await waitFor(() => expect(screen.getByTestId('save-unit')).toBeEnabled());
  await fireEvent.press(screen.getByTestId('save-unit'));
  await waitFor(() => expect(m.saveUnitEdit).toHaveBeenCalledWith('A-1', 4, expect.objectContaining({ price_value: '8500000' }), expect.any(String)));
  await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
});

test('edit shows all four sections at once, and a description with no text is written from the fields', async () => {
  m.unit.mockResolvedValue({ images: [] });
  m.unitEditFields.mockResolvedValue({ code: 'A-1', version: 4, fields: { listing_type: 'sale', property_type: 'apartment', bedrooms: '3', clean_summary: '' } });
  await render(<QueryClientProvider client={client()}><AddUnitScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTestId('f-price_value')).toBeTruthy()); // step 2
  expect(screen.getByTestId('clean-summary')).toBeTruthy(); // step 4
  expect(screen.queryByTestId('step-bar')).toBeNull(); // the jump links, not the step bar
  await waitFor(() => expect(screen.getByTestId('clean-summary').props.value).toMatch(/3 (bedrooms|غرف)/));
});

test('a stale version says the unit changed elsewhere', async () => {
  m.unit.mockResolvedValue({ images: [] });
  m.unitEditFields.mockResolvedValue({ code: 'A-1', version: 4, fields: { compound: 'Mivida' } });
  m.saveUnitEdit.mockRejectedValue(new ApiClientError(409, 'conflict'));
  await render(<QueryClientProvider client={client()}><AddUnitScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText(/Mivida/)).toBeTruthy());
  await waitFor(() => expect(screen.getByTestId('save-unit')).toBeEnabled());
  await fireEvent.press(screen.getByTestId('save-unit'));
  await waitFor(() => expect(screen.getByTestId('unit-error')).toBeTruthy());
  expect(mockGoBack).not.toHaveBeenCalled();
});

test('an owner name that is just the phone loads as the "use phone as name" toggle with an empty name', async () => {
  m.unit.mockResolvedValue({ images: [] });
  m.unitEditFields.mockResolvedValue({ code: 'A-1', version: 4, fields: { listing_type: 'sale', owner_phone: '+201012345622', owner_name: '0101 234 5622' } });
  m.saveUnitEdit.mockResolvedValue({ code: 'A-1', version: 5 });
  await render(<QueryClientProvider client={client()}><AddUnitScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTestId('f-owner_phone')).toBeTruthy());
  await waitFor(() => expect(screen.getByTestId('f-owner_name').props.value).toBe(''));
  await waitFor(() => expect(screen.getByTestId('f-owner_name_from_phone').props.value).toBe(true));
});

test('the unit page shows Edit only when the server says canEdit', async () => {
  mockParams = undefined;
  m.unit.mockResolvedValue({ ...unit, canEdit: true });
  m.unitContact.mockResolvedValue({ name: null, phone: null });
  const first = await render(<QueryClientProvider client={client()}><UnitScreen code="A-1" /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTestId('edit-unit')).toBeTruthy());
  first.unmount();
  m.unit.mockResolvedValue({ ...unit, canEdit: false });
  await render(<QueryClientProvider client={client()}><UnitScreen code="A-1" /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTestId('share-unit')).toBeTruthy());
  expect(screen.queryByTestId('edit-unit')).toBeNull();
});
