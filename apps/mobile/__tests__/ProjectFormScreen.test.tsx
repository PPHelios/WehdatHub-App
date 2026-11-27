import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClientError } from '@wehdathub/shared';
import type { BoxPlace } from '@wehdathub/shared';
import { ProjectFormScreen } from '../src/screens/ProjectFormScreen';
import { api } from '../src/api';
import { usePlaces } from '../src/placeList';

jest.mock('../src/api', () => ({ api: { readProject: jest.fn(), saveProject: jest.fn(), projectPhotos: jest.fn(), project: jest.fn(), placeBox: jest.fn(), placeList: jest.fn().mockRejectedValue(new Error('offline')), developerSuggest: jest.fn(), catalogue: jest.fn() } }));
const mockNav = { goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), addListener: jest.fn(() => () => undefined), dispatch: jest.fn() };
let mockParams: { id?: string } | undefined;
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }) }));
const m = api as unknown as Record<string, jest.Mock>;

const obour: BoxPlace = { kind: 'area', id: 'a-obour', name_en: 'New Obour', name_ar: 'العبور الجديدة', label: 'New Obour', path: 'Qalyubia', zones: [], via: 'name', area_id: 'a-obour', subzone_id: null };
const mostakbal: BoxPlace = { kind: 'subzone', id: 's1', name_en: 'Mostakbal', name_ar: 'المستقبل', label: 'Mostakbal', path: 'Cairo › New Cairo', zones: [], via: 'name', area_id: 'a-cairo', subzone_id: 's1' };
const hyde: BoxPlace = { kind: 'compound', id: 'p1', name_en: 'Hyde Park', name_ar: 'هايد بارك', label: 'Hyde Park', path: 'New Cairo', zones: [], via: 'name', area_id: 'a-cairo', subzone_id: null };
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ProjectFormScreen /></QueryClientProvider>);
const MESSAGE = 'النهارده بنعلن عن ARABISK DEVELOPMENT New Obour City مشروع جديد على مساحة 15 Feddan Total Price from 2,000,000 LE';

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = undefined;
  usePlaces.setState({ list: null, pending: [], checkedAt: 0 });
  m.placeBox.mockResolvedValue({ items: [obour, mostakbal, hyde] });
  m.developerSuggest.mockResolvedValue({ items: [{ id: 'd1', name: 'Emaar', name_en: 'Emaar' }, { global_id: 'g1', name: 'Arabisk' }] });
  m.saveProject.mockResolvedValue({ ok: true, id: 'p77' });
});

const pickArea = async () => {
  await fireEvent.changeText(screen.getByTestId('pbox-input'), 'obour');
  await waitFor(() => expect(screen.getByTestId('pbox-opt-a-obour')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('pbox-opt-a-obour'));
};

test('a pasted launch message fills the form from the free reader and says what it found', async () => {
  m.readProject.mockResolvedValue({
    name: 'THE NEW BALANCE', name_en: null, name_candidates: [], developer: { name: 'ARABISK DEVELOPMENT', new: true }, place: obour, features: [{ key: 'roof', label: 'Roof' }], existing: { id: 'p9', name: 'New Balance' },
    fields: { area_acres: 15, status: 'launching', price_from: 2000000, bedrooms: [2, 3, 4], property_types: ['apartment'] }, offers: [], facts: [], found: ['name', 'developer', 'place', 'price_from'],
  });
  await wrap();
  await fireEvent.changeText(screen.getByTestId('pf-paste'), MESSAGE);
  await waitFor(() => expect(m.readProject).toHaveBeenCalledWith(MESSAGE));
  await waitFor(() => expect(screen.getByTestId('pf-name').props.value).toBe('THE NEW BALANCE'));
  expect(screen.getByTestId('pf-read-note')).toBeTruthy();
  expect(screen.getByTestId('pbox-place')).toBeTruthy(); // the area chip
  expect(screen.getByTestId('pbox-feature-roof')).toBeTruthy();
  // The project is already in the catalogue: say so and link to it.
  await fireEvent.press(screen.getByTestId('pf-known'));
  expect(mockNav.navigate).toHaveBeenCalledWith('Project', { id: 'p9', name: 'New Balance' });
  // The developer and the numbers fill the later sections.
  await fireEvent.press(screen.getByTestId('step-3'));
  expect(screen.getByTestId('dev-state')).toHaveTextContent('ARABISK DEVELOPMENT (مطور جديد)');
  await fireEvent.press(screen.getByTestId('step-2'));
  expect(screen.getByTestId('pf-price_from').props.value).toBe('2,000,000');
  expect(screen.getByTestId('pf-area_acres').props.value).toBe('15');
});

test('the area is searched without compounds and shows its parents and governorate', async () => {
  await wrap();
  await fireEvent.changeText(screen.getByTestId('pbox-input'), 'hyde');
  await waitFor(() => expect(screen.getByTestId('pbox-opt-s1')).toBeTruthy());
  expect(m.placeBox).toHaveBeenCalledWith('hyde', expect.any(String), 'areas');
  expect(screen.queryByTestId('pbox-opt-p1')).toBeNull(); // a compound is never offered
  await fireEvent.press(screen.getByTestId('pbox-opt-s1'));
  expect(screen.getByTestId('pbox-context')).toHaveTextContent(/Cairo › New Cairo/);
  expect(screen.getByTestId('pbox-context')).toHaveTextContent(/Cairo/);
});

test('Next needs the name and the area; the rest is optional', async () => {
  await wrap();
  await fireEvent.press(screen.getByTestId('pf-next'));
  expect(screen.getByTestId('blockers')).toBeTruthy();
  expect(screen.getByTestId('pf-section-1')).toBeTruthy();
  expect(screen.queryByTestId('pf-section-2')).toBeNull();
  await fireEvent.changeText(screen.getByTestId('pf-name'), 'Jazeel');
  await pickArea();
  await fireEvent.press(screen.getByTestId('pf-next'));
  expect(screen.getByTestId('pf-section-2')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('pf-next'));
  expect(screen.getByTestId('pf-section-3')).toBeTruthy();
  expect(screen.getByTestId('pf-save')).toBeTruthy();
});

test('a new project saves the website fields: area, a new developer, numbers, choices', async () => {
  await wrap();
  await fireEvent.changeText(screen.getByTestId('pf-name'), 'Jazeel');
  await pickArea();
  await fireEvent.press(screen.getByTestId('pf-next'));
  await fireEvent.changeText(screen.getByTestId('pf-price_from'), '٢٬٠٠٠٬٠٠٠');
  await fireEvent.changeText(screen.getByTestId('pf-down_pct_min'), '5');
  await fireEvent.press(screen.getByText('3'));
  await fireEvent.press(screen.getByTestId('pf-next'));
  await fireEvent.changeText(screen.getByTestId('dev-input'), 'Brand New Dev');
  await waitFor(() => expect(screen.getByTestId('dev-add')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('dev-add'));
  await fireEvent.press(screen.getByTestId('pf-save'));
  await waitFor(() => expect(m.saveProject).toHaveBeenCalled());
  expect(m.saveProject).toHaveBeenCalledWith({ name: 'Jazeel', status: 'selling', area_id: 'a-obour', price_from: '2000000', down_pct_min: '5', bedrooms: ['3'], developer_name: 'Brand New Dev', paste_text: '' }, undefined);
  await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('Project', { id: 'p77', name: 'Jazeel' }));
});

test('picking an agency developer or a global name sends its id, not a name', async () => {
  await wrap();
  await fireEvent.changeText(screen.getByTestId('pf-name'), 'X');
  await pickArea();
  await fireEvent.press(screen.getByTestId('step-3'));
  await fireEvent.changeText(screen.getByTestId('dev-input'), 'a');
  await waitFor(() => expect(screen.getByTestId('dev-opt-g1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('dev-opt-g1'));
  await fireEvent.press(screen.getByTestId('pf-save'));
  await waitFor(() => expect(m.saveProject).toHaveBeenCalledWith(expect.objectContaining({ developer_global_id: 'g1' }), undefined));
  expect(m.saveProject.mock.calls[0][0].developer_name).toBeUndefined();
});

test('a sub-area that is not on the list is requested with its parent; the project saves with the website fields', async () => {
  await wrap();
  await fireEvent.changeText(screen.getByTestId('pf-name'), 'Elite Tower');
  await fireEvent.changeText(screen.getByTestId('pbox-input'), 'Elite');
  await waitFor(() => expect(screen.getByTestId('pbox-request')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('pbox-request'));
  expect(screen.getByTestId('pbox-new-save').props.accessibilityState.disabled).toBe(true); // the parent is required
  await fireEvent.changeText(screen.getByTestId('pbox-new-ar'), 'إيليت');
  await fireEvent.changeText(screen.getByTestId('pbox-new-parent-input'), 'most');
  await waitFor(() => expect(screen.getByTestId('pbox-new-area-s1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('pbox-new-area-s1'));
  await fireEvent.press(screen.getByTestId('pbox-new-save'));
  expect(screen.getByTestId('pbox-pending')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('step-3'));
  await fireEvent.press(screen.getByTestId('pf-save'));
  await waitFor(() => expect(m.saveProject).toHaveBeenCalled());
  expect(m.saveProject.mock.calls[0][0]).toMatchObject({ compound: 'Elite', compound_new: '1', compound_ar: 'إيليت', area_id: 'a-cairo', subzone_id: 's1' });
});

test('a bad value from the server names the field and nothing is lost', async () => {
  m.saveProject.mockRejectedValue(new ApiClientError(422, 'invalid', null, { field: 'price_from' }));
  await wrap();
  await fireEvent.changeText(screen.getByTestId('pf-name'), 'X');
  await pickArea();
  await fireEvent.press(screen.getByTestId('step-3'));
  await fireEvent.press(screen.getByTestId('pf-save'));
  await waitFor(() => expect(screen.getByTestId('pf-error')).toBeTruthy());
  expect(screen.getByTestId('pf-error')).toHaveTextContent(/السعر يبدأ من/);
  expect(mockNav.replace).not.toHaveBeenCalled();
});

test('photos are picked on a new project (up to 10, shared); sorting with AI is not part of this form', async () => {
  await wrap();
  await fireEvent.changeText(screen.getByTestId('pf-name'), 'X');
  await pickArea();
  await fireEvent.press(screen.getByTestId('step-3'));
  expect(screen.getByTestId('pf-add-photos')).toBeTruthy();
  expect(screen.queryByText('رتب بالذكاء الاصطناعي')).toBeNull();
});

test('edit shows all three sections with one Save, from the saved project', async () => {
  mockParams = { id: 'p5' };
  m.project.mockResolvedValue({ project: { id: 'p5', name: 'Mivida', status: 'selling', price_from: 3000000, bedroom_options: [2], district: 'New Cairo', city: 'Cairo', area_id: 'a-cairo', source_text: 'old message' }, developer: { id: 'd1', name: 'Emaar' }, phases: [], plans: [], materials: [], units: [], canEdit: true });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('pf-name').props.value).toBe('Mivida'));
  expect(screen.getByTestId('pf-section-2')).toBeTruthy();
  expect(screen.getByTestId('pf-section-3')).toBeTruthy();
  expect(screen.queryByTestId('step-bar')).toBeNull();
  expect(screen.queryByTestId('pf-next')).toBeNull();
  await fireEvent.press(screen.getByTestId('pf-save'));
  await waitFor(() => expect(m.saveProject).toHaveBeenCalledWith(expect.objectContaining({ name: 'Mivida', developer_id: 'd1', area_id: 'a-cairo', paste_text: 'old message' }), 'p5'));
  await waitFor(() => expect(mockNav.goBack).toHaveBeenCalled());
});
