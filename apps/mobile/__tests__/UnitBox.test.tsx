import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { BoxPlace } from '@wehdathub/shared';
import { PASTE_MIN, UnitBox } from '../src/components/UnitBox';
import { NO_PLACE, placePatch, resolvePatch } from '../src/unitBoxRules';
import { api } from '../src/api';
import { usePlaces } from '../src/placeList';

jest.mock('../src/api', () => ({ api: { placeBox: jest.fn(), placeBoxResolve: jest.fn(), placeList: jest.fn().mockRejectedValue(new Error('offline')) } }));
const m = api as unknown as { placeBox: jest.Mock; placeBoxResolve: jest.Mock };

const hyde: BoxPlace = { kind: 'compound', id: 'p1', name_en: 'Hyde Park', name_ar: 'هايد بارك', label: 'Hyde Park', path: 'New Cairo › 5th Settlement', zones: ['Golden Square'], via: 'name', area_id: 'a1', subzone_id: 's5' };
const golden: BoxPlace = { kind: 'subzone', id: 's1', name_en: 'Golden Square', name_ar: 'المربع الذهبي', label: 'Golden Square', path: 'New Cairo', zones: [], via: 'name', area_id: 'a1', subzone_id: 's1' };
const newCairo: BoxPlace = { kind: 'area', id: 'a1', name_en: 'New Cairo', name_ar: 'القاهرة الجديدة', label: 'New Cairo', path: '', zones: [], via: 'name', area_id: 'a1', subzone_id: null };
const roof = { kind: 'feature' as const, key: 'roof', label: 'Roof' };
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  m.placeBox.mockResolvedValue({ items: [] });
  usePlaces.setState({ list: null, pending: [], checkedAt: 0 });
});

test('typing asks the box for places and features, and lists the places first', async () => {
  m.placeBox.mockResolvedValue({ items: [hyde, roof] });
  await wrap(<UnitBox fields={{}} patch={jest.fn()} lang="en" />);
  await fireEvent.changeText(screen.getByTestId('unit-box-input'), 'hyd');
  await waitFor(() => expect(screen.getByTestId('ubox-opt-p1')).toBeTruthy());
  expect(m.placeBox).toHaveBeenCalledWith('hyd', 'en');
  expect(screen.getByTestId('ubox-opt-roof')).toBeTruthy();
  expect(screen.getByText(/Golden Square/)).toBeTruthy(); // the zone shows under the place
});

test('a short text asks nothing', async () => {
  await wrap(<UnitBox fields={{}} patch={jest.fn()} lang="en" />);
  await fireEvent.changeText(screen.getByTestId('unit-box-input'), 'h');
  await new Promise<void>((r) => setTimeout(() => r(), 300));
  expect(m.placeBox).not.toHaveBeenCalled();
});

test('picking a compound writes the place fields the form sent before, with its area', async () => {
  m.placeBox.mockResolvedValue({ items: [hyde] });
  const patch = jest.fn();
  await wrap(<UnitBox fields={{}} patch={patch} lang="en" />);
  await fireEvent.changeText(screen.getByTestId('unit-box-input'), 'hyde');
  await waitFor(() => expect(screen.getByTestId('ubox-opt-p1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('ubox-opt-p1'));
  expect(patch).toHaveBeenCalledWith(expect.objectContaining({ compound: 'Hyde Park', compound_new: '', area_id: 'a1', subzone_id: 's5', place_path: 'New Cairo › 5th Settlement', place_zones: 'Golden Square' }));
});

test('picking a sub-area leaves the compound empty and keeps its parent area', () => {
  expect(placePatch(golden)).toMatchObject({ compound: '', area_id: 'a1', subzone_id: 's1', place_label: 'Golden Square' });
});

test('a second place replaces the first: the chip shows the new one and the old area goes', async () => {
  const patch = jest.fn();
  m.placeBox.mockResolvedValue({ items: [golden] });
  await wrap(<UnitBox fields={{ compound: 'Hyde Park', place_label: 'Hyde Park', area_id: 'a1', subzone_id: 's5' }} patch={patch} lang="en" />);
  expect(screen.getByTestId('ubox-place')).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId('unit-box-input'), 'gold');
  await waitFor(() => expect(screen.getByTestId('ubox-opt-s1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('ubox-opt-s1'));
  expect(patch).toHaveBeenCalledWith(expect.objectContaining({ compound: '', area_id: 'a1', subzone_id: 's1', place_label: 'Golden Square' }));
});

test('removing the place chip clears its fields', async () => {
  const patch = jest.fn();
  await wrap(<UnitBox fields={{ compound: 'Hyde Park', place_label: 'Hyde Park' }} patch={patch} lang="en" />);
  await fireEvent.press(screen.getByTestId('ubox-place'));
  expect(patch).toHaveBeenCalledWith(NO_PLACE);
});

test('a feature is a chip that writes the feature list', async () => {
  m.placeBox.mockResolvedValue({ items: [roof] });
  const patch = jest.fn();
  await wrap(<UnitBox fields={{}} patch={patch} lang="en" />);
  await fireEvent.changeText(screen.getByTestId('unit-box-input'), 'roof');
  await waitFor(() => expect(screen.getByTestId('ubox-opt-roof')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('ubox-opt-roof'));
  expect(patch).toHaveBeenCalledWith({ feature: ['roof'] });
});

test('removing a feature chip takes it out', async () => {
  const again = jest.fn();
  await wrap(<UnitBox fields={{ feature: ['roof'] }} patch={again} lang="en" />);
  await fireEvent.press(screen.getByTestId('ubox-feature-roof'));
  expect(again).toHaveBeenCalledWith({ feature: [] });
});

test('a word that matches nothing becomes a grey other feature, written to features_other', async () => {
  const patch = jest.fn();
  await wrap(<UnitBox fields={{}} patch={patch} lang="en" />);
  await fireEvent.changeText(screen.getByTestId('unit-box-input'), 'jacuzzi');
  await waitFor(() => expect(screen.getByTestId('ubox-other')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('ubox-other'));
  expect(patch).toHaveBeenCalledWith({ features_other: 'jacuzzi' });
});

test('no more than 20 other features: a 21st is not added', async () => {
  const patch = jest.fn();
  const twenty = Array.from({ length: 20 }, (_v, i) => `x${i}`).join('، ');
  await wrap(<UnitBox fields={{ features_other: twenty }} patch={patch} lang="en" />);
  await fireEvent.changeText(screen.getByTestId('unit-box-input'), 'jacuzzi');
  await waitFor(() => expect(screen.getByTestId('ubox-other')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('ubox-other'));
  expect(patch).not.toHaveBeenCalled();
});

test('a paste is read into the place and the features, free, and keeps a place already set', async () => {
  m.placeBoxResolve.mockResolvedValue({ place: hyde, features: [{ key: 'north_facing', label: 'North facing' }] });
  const patch = jest.fn();
  await wrap(<UnitBox fields={{}} patch={patch} lang="en" />);
  const text = 'شقة للبيع في هايد بارك 150 متر 3 غرف بحري روف';
  expect(text.length).toBeGreaterThanOrEqual(PASTE_MIN);
  await fireEvent.changeText(screen.getByTestId('unit-box-input'), text);
  await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.objectContaining({ compound: 'Hyde Park', feature: ['north_facing'] })));
  expect(m.placeBoxResolve).toHaveBeenCalledWith(text);
  expect(resolvePatch({ place: hyde, features: [] }, { compound: 'Mivida' })).toEqual({});
  expect(resolvePatch({ place: null, features: [{ key: 'roof', label: 'Roof' }] }, { feature: ['roof'] })).toEqual({});
});

test('request a new place: name, area and the save writes a pending compound with its area', async () => {
  m.placeBox.mockImplementation(async (q: string) => ({ items: q === 'zed' ? [] : [newCairo] }));
  const patch = jest.fn();
  await wrap(<UnitBox fields={{ compound: 'Zed', compound_new: '1' }} patch={patch} lang="en" />);
  expect(screen.getByTestId('ubox-new')).toBeTruthy();
  expect(screen.getByTestId('ubox-new-save').props.accessibilityState.disabled).toBe(true);
  await fireEvent.changeText(screen.getByTestId('ubox-new-parent-input'), 'new');
  await waitFor(() => expect(screen.getByTestId('ubox-new-area-a1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('ubox-new-area-a1'));
  expect(screen.getByTestId('ubox-new-save').props.accessibilityState.disabled).toBe(false);
  await fireEvent.press(screen.getByTestId('ubox-new-save'));
  expect(patch).toHaveBeenCalledWith({ compound: 'Zed', compound_new: '1', compound_ar: '', compound_pin: '', area_id: 'a1', subzone_id: '', place_label: 'Zed', place_path: 'New Cairo', place_zones: '', phase_label: '', place_phases: '' });
});

test('the new-place form asks for the district and city, and cancel clears the place', async () => {
  const patch = jest.fn();
  await wrap(<UnitBox fields={{ compound: 'Zed', compound_new: '1' }} patch={patch} lang="en" />);
  expect(screen.getByTestId('ubox-new-district')).toBeTruthy();
  expect(screen.getByTestId('ubox-new-city')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('ubox-new-cancel'));
  expect(patch).toHaveBeenCalledWith(NO_PLACE);
});

test('placePatch keeps the place name in its own field for the chip', () => {
  expect(placePatch(hyde)).toMatchObject({ compound: 'Hyde Park', place_label: 'Hyde Park' });
});

const saved = {
  version: 'v2',
  areas: [{ id: 'a1', parent_id: null, name_en: 'New Cairo', name_ar: 'القاهرة الجديدة', aliases: [], lat: null, lng: null }],
  places: [{ id: 'p1', name_en: 'Hyde Park', name_ar: 'هايد بارك', aliases: [], area_id: 'a1', subzone_id: null, lat: null, lng: null }],
  zones: [],
  features: [{ key: 'roof', ar: 'روف', en: 'Roof', syn: ['روف', 'roof'] }],
};

test('with the saved list the box answers on the phone, offline, with no call to the server', async () => {
  usePlaces.setState({ list: saved, checkedAt: Date.now() });
  const patch = jest.fn();
  await wrap(<UnitBox fields={{}} patch={patch} lang="en" />);
  await fireEvent.changeText(screen.getByTestId('unit-box-input'), 'hyd');
  await waitFor(() => expect(screen.getByTestId('ubox-opt-p1')).toBeTruthy());
  await fireEvent.changeText(screen.getByTestId('unit-box-input'), 'roo');
  await waitFor(() => expect(screen.getByTestId('ubox-opt-roof')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('ubox-opt-roof'));
  expect(patch).toHaveBeenCalledWith({ feature: ['roof'] });
  expect(m.placeBox).not.toHaveBeenCalled();
});

test('a place this broker just added shows at once from the saved list', async () => {
  usePlaces.setState({ list: saved, pending: [{ id: 'pending:Zed Park', name_en: 'Zed Park', name_ar: null, aliases: [], area_id: null, subzone_id: null, lat: null, lng: null }], checkedAt: Date.now() });
  await wrap(<UnitBox fields={{}} patch={jest.fn()} lang="en" />);
  await fireEvent.changeText(screen.getByTestId('unit-box-input'), 'zed');
  await waitFor(() => expect(screen.getByTestId('ubox-opt-pending:Zed Park')).toBeTruthy());
});

test('a list saved before features existed still asks the server', async () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropping two keys to build an old saved shape
  const { features: _f, zones: _z, ...old } = saved;
  usePlaces.setState({ list: old, checkedAt: Date.now() });
  m.placeBox.mockResolvedValue({ items: [{ kind: 'feature', key: 'roof', label: 'Roof' }] });
  await wrap(<UnitBox fields={{}} patch={jest.fn()} lang="en" />);
  await fireEvent.changeText(screen.getByTestId('unit-box-input'), 'roo');
  await waitFor(() => expect(screen.getByTestId('ubox-opt-roof')).toBeTruthy());
  expect(m.placeBox).toHaveBeenCalledWith('roo', 'en');
});

test('opening the form checks the saved list against the server', async () => {
  await wrap(<UnitBox fields={{}} patch={jest.fn()} lang="en" />);
  await waitFor(() => expect((api as unknown as { placeList: jest.Mock }).placeList).toHaveBeenCalled());
});
