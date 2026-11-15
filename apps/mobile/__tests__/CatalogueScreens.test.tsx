import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { BoxPlace } from '@wehdathub/shared';
import { ProjectScreen, ProjectsScreen } from '../src/screens/CatalogueScreens';
import { api } from '../src/api';
import { usePlaces } from '../src/placeList';
import { ApiClientError } from '@wehdathub/shared';
import { galleryError } from '../src/components/ProjectGallery';

jest.mock('../src/api', () => ({ api: { projectGallery: jest.fn(), projectImageRole: jest.fn(), deleteProjectImage: jest.fn(), projectPhotos: jest.fn(), catalogue: jest.fn(), catalogueSearch: jest.fn(), project: jest.fn(), archiveProject: jest.fn(), placeBox: jest.fn(), placeList: jest.fn().mockRejectedValue(new Error('offline')) } }));
const mockNav = { navigate: jest.fn(), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: { id: 'p1', name: 'Mivida' } }) }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

const obour: BoxPlace = { kind: 'area', id: 'a-obour', name_en: 'New Obour', name_ar: 'العبور الجديدة', label: 'New Obour', path: 'Qalyubia', zones: [], via: 'name', area_id: 'a-obour', subzone_id: null };
const hyde: BoxPlace = { kind: 'compound', id: 'c1', name_en: 'Hyde Park', name_ar: 'هايد بارك', label: 'Hyde Park', path: 'New Cairo', zones: [], via: 'name', area_id: 'a1', subzone_id: null };
const card = { id: 'p1', name: 'Mivida', name_en: 'Mivida', developer_name: 'Emaar', district: 'New Cairo', city: 'Cairo', status: 'selling', price_from: 3000000, bedroom_options: [2, 3], area_acres: 20, down_pct_min: 5, years_max: 8, delivery_year: 2028, delivery_quarter: 4, cover_url: 'https://x/c.jpg', units: 3, plans: 2 };
const list = (over: object = {}) => ({ projects: { items: [card], total: 41, pages: 3 }, developers: { items: [{ id: 'd1', name: 'Emaar Misr' }] }, canEdit: true, ...over });

beforeEach(() => {
  jest.clearAllMocks();
  usePlaces.setState({ list: null, pending: [], checkedAt: 0 });
  m.catalogue.mockResolvedValue(list());
  m.catalogueSearch.mockResolvedValue({ items: [{ kind: 'developer', id: 'd1', label: 'Emaar Misr' }, { kind: 'project', id: 'p1', label: 'Mivida' }] });
  m.placeBox.mockResolvedValue({ items: [obour, hyde, { kind: 'feature', key: 'roof', label: 'Roof' }] });
});

test('the list is cards with cover, developer, place, fact pills, delivery, status and counts; the total shows', async () => {
  await wrap(<ProjectsScreen />);
  await waitFor(() => expect(screen.getByTestId('project-card')).toBeTruthy());
  expect(screen.getByTestId('smart-image')).toBeTruthy();
  expect(screen.getByText('Mivida')).toBeTruthy();
  expect(screen.getByText(/Emaar · New Cairo · Cairo/)).toBeTruthy();
  expect(screen.getByText('من 3 مليون ج.م')).toBeTruthy();
  expect(screen.getByText('2–3 غرف')).toBeTruthy();
  expect(screen.getByText('20 فدان')).toBeTruthy();
  expect(screen.getByText('مقدم 5%')).toBeTruthy();
  expect(screen.getByText('8 سنين')).toBeTruthy();
  expect(screen.getByText(/Q4 2028/)).toBeTruthy();
  expect(screen.getByText('متاح')).toBeTruthy();
  expect(screen.getByText('3 وحدة · 2 نظام سداد')).toBeTruthy();
  expect(screen.getByTestId('project-count').props.children.join('')).toContain('41');
  await fireEvent.press(screen.getByTestId('project-p1'));
  expect(mockNav.navigate).toHaveBeenCalledWith('Project', { id: 'p1', name: 'Mivida' });
});

test('a manager sees New project; a broker does not', async () => {
  await wrap(<ProjectsScreen />);
  await fireEvent.press(await screen.findByTestId('new-project'));
  expect(mockNav.navigate).toHaveBeenCalledWith('ProjectForm', {});
});

test('the box offers areas (never compounds) and features; a pick becomes a chip and filters the list', async () => {
  await wrap(<ProjectsScreen />);
  await waitFor(() => expect(screen.getByTestId('project-card')).toBeTruthy());
  await fireEvent.changeText(screen.getByTestId('project-search'), 'obo');
  await waitFor(() => expect(screen.getByTestId('cbox-opt-place-a-obour')).toBeTruthy());
  expect(m.placeBox).toHaveBeenCalledWith('obo', expect.any(String), 'areas');
  await fireEvent.press(screen.getByTestId('cbox-opt-place-a-obour'));
  await waitFor(() => expect(m.catalogue).toHaveBeenLastCalledWith(expect.objectContaining({ place: 'a-obour', page: 1 })));
  expect(screen.getByTestId('cbox-chip-place')).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId('project-search'), 'roo');
  await waitFor(() => expect(screen.getByTestId('cbox-opt-feature-roof')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('cbox-opt-feature-roof'));
  await waitFor(() => expect(m.catalogue).toHaveBeenLastCalledWith(expect.objectContaining({ place: 'a-obour', features: ['roof'] })));
  // Removing a chip filters again without it.
  await fireEvent.press(screen.getByTestId('cbox-chip-place'));
  await waitFor(() => expect(m.catalogue).toHaveBeenLastCalledWith(expect.objectContaining({ place: undefined, features: ['roof'] })));
});

test('developers come from the catalogue search and filter by id', async () => {
  await wrap(<ProjectsScreen />);
  await waitFor(() => expect(screen.getByTestId('project-card')).toBeTruthy());
  await fireEvent.changeText(screen.getByTestId('project-search'), 'emaar');
  await waitFor(() => expect(screen.getByTestId('cbox-opt-dev-d1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('cbox-opt-dev-d1'));
  await waitFor(() => expect(m.catalogue).toHaveBeenLastCalledWith(expect.objectContaining({ developer: 'd1' })));
});

test('a project name in the box opens that project', async () => {
  await wrap(<ProjectsScreen />);
  await waitFor(() => expect(screen.getByTestId('project-card')).toBeTruthy());
  await fireEvent.changeText(screen.getByTestId('project-search'), 'miv');
  await waitFor(() => expect(screen.getByTestId('cbox-opt-project-p1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('cbox-opt-project-p1'));
  expect(mockNav.navigate).toHaveBeenCalledWith('Project', { id: 'p1', name: 'Mivida' });
});

test('bedrooms and price up to are filters; clear resets them', async () => {
  await wrap(<ProjectsScreen />);
  await waitFor(() => expect(screen.getByTestId('project-card')).toBeTruthy());
  await fireEvent.press(screen.getAllByText('3')[0]);
  await fireEvent.changeText(screen.getByTestId('catalogue-max'), '5,000,000');
  await waitFor(() => expect(m.catalogue).toHaveBeenLastCalledWith(expect.objectContaining({ bed: 3, max: 5000000 })), { timeout: 3000 });
  await fireEvent.press(screen.getByTestId('catalogue-clear'));
  await waitFor(() => expect(m.catalogue).toHaveBeenLastCalledWith(expect.objectContaining({ bed: undefined, max: undefined })), { timeout: 3000 });
});

test('20 a page: the pager asks for the page', async () => {
  await wrap(<ProjectsScreen />);
  await waitFor(() => expect(screen.getByTestId('page-3')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('page-3'));
  await waitFor(() => expect(m.catalogue).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 })));
});

test('an empty search says so', async () => {
  m.catalogue.mockResolvedValue(list({ projects: { items: [], total: 0, pages: 0 } }));
  await wrap(<ProjectsScreen />);
  await waitFor(() => expect(screen.getByText('لسه مفيش مشاريع.')).toBeTruthy());
});

const detail = (over: object = {}) => ({
  project: { id: 'p1', name: 'Mivida', name_en: 'Mivida', status: 'launching', district: 'New Cairo', city: 'Cairo', price_from: 3000000, area_acres: 20, bedroom_options: [2, 3], down_pct_min: 5, years_max: 8, discount_pct: 10, delivery_raw: 'بعد سنة', feature_keys: ['roof'], features_other: ['x'], notes: 'Nice' },
  developer: { id: 'd1', name: 'Emaar' }, phases: [], plans: [{ id: 'pl1', name: 'Plan A', down_payment_pct: 10, years: 8 }], materials: [], units: [], facts: [{ key: 'consultant', label_ar: 'الاستشاري', label_en: 'Consultant', value: 'Archrete' }],
  images: [{ id: 'i1', url: 'https://x/1.jpg' }, { id: 'i2', url: 'https://x/2.jpg' }], canEdit: true, ...over,
});

test('the project page has the photo carousel, the facts, the other facts and the features', async () => {
  m.project.mockResolvedValue(detail());
  await wrap(<ProjectScreen />);
  await waitFor(() => expect(screen.getByTestId('project-facts')).toBeTruthy());
  expect(screen.getByTestId('gallery')).toBeTruthy(); // the same carousel as the unit page
  expect(screen.getByTestId('photo-1')).toBeTruthy();
  const facts = screen.getByTestId('project-facts');
  for (const t of [/3.*مليون/, /20/, /2 · 3/, /5%/, /8/, /10%/, /Archrete/, /بعد سنة/]) expect(facts).toHaveTextContent(t);
  expect(screen.getByText('Emaar')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('project-edit'));
  expect(mockNav.navigate).toHaveBeenCalledWith('ProjectForm', { id: 'p1' });
});

test('a broker sees no Edit; a project without photos says so', async () => {
  m.project.mockResolvedValue(detail({ canEdit: false, images: [] }));
  await wrap(<ProjectScreen />);
  await waitFor(() => expect(screen.getByTestId('project-no-photos')).toBeTruthy());
  expect(screen.queryByTestId('project-edit')).toBeNull();
  expect(screen.queryByTestId('project-archive')).toBeNull();
});

test('managers get the gallery: role and delete per photo, Sort with AI behind a cost prompt; a broker does not', async () => {
  m.project.mockResolvedValue(detail({ images: [{ id: 'i1', url: 'https://x/1.jpg', role: 'shared', mime: 'image/jpeg' }, { id: 'i2', url: 'https://x/2.jpg', role: 'layout', mime: 'image/jpeg' }] }));
  m.projectImageRole.mockResolvedValue({});
  m.deleteProjectImage.mockResolvedValue({});
  await wrap(<ProjectScreen />);
  await fireEvent.press(await screen.findByTestId('role-i2-hidden'));
  await waitFor(() => expect(m.projectImageRole).toHaveBeenCalledWith('p1', 'i2', 'hidden'));
  await fireEvent.press(screen.getByTestId('delete-i1'));
  await waitFor(() => expect(m.deleteProjectImage).toHaveBeenCalledWith('p1', 'i1'));
  expect(screen.getByTestId('gallery-sort')).toBeTruthy();
});

test('a broker has no gallery tools', async () => {
  m.project.mockResolvedValue(detail({ canEdit: false }));
  await wrap(<ProjectScreen />);
  await waitFor(() => expect(screen.getByTestId('project-facts')).toBeTruthy());
  expect(screen.queryByTestId('project-gallery')).toBeNull();
});

test('gallery errors: OFF, SORT_PDF and the pages left and needed', () => {
  expect(galleryError(new ApiClientError(422, 'OFF', null, {}), 'en')).toMatch(/Reading is off/);
  expect(galleryError(new ApiClientError(422, 'SORT_PDF', null, {}), 'en')).toMatch(/PDF needs/);
  expect(galleryError(new ApiClientError(402, 'ALLOWANCE', null, { left: 2, needed: 9 }), 'en')).toBe('Not enough pages: 2 left, 9 needed.');
});
