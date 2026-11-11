import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MapScreen } from '../src/screens/MapScreen';
import { api } from '../src/api';
import { usePlaces } from '../src/placeList';

const mockNavigate = jest.fn();
jest.mock('../src/api', () => ({ api: { map: jest.fn(), mapUnits: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
const mocked = api as unknown as { map: jest.Mock; mapUnits: jest.Mock };
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MapScreen /></QueryClientProvider>);

const data = { tilesUrl: 'https://x.r2.dev/egypt.pmtiles', pins: [{ id: 'p1', n: 2, name: 'Mivida', lat: 30, lng: 31 }], total: 2, unmapped: 0, facets: { types: ['apartment'], rooms: [2, 3] } };

test('without a tiles address the map says it is not set up', async () => {
  mocked.map.mockResolvedValue({ ...data, tilesUrl: null });
  await wrap();
  await waitFor(() => expect(screen.getByText(/not set up|لسه متفعلتش/)).toBeTruthy());
});

test('tapping a pin lists its units and a unit opens', async () => {
  mocked.map.mockResolvedValue(data);
  mocked.mapUnits.mockResolvedValue({ place: { id: 'p1', name_en: 'Mivida', name_ar: null }, items: [{ code: 'MV-1', title: null, propertyType: 'apartment', listingType: 'sale', bedrooms: 3, bathrooms: 2, area: 150, price: 9000000, priceText: null }] });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('map-web')).toBeTruthy());
  fireEvent(screen.getByTestId('map-web'), 'message', { nativeEvent: { data: JSON.stringify({ type: 'pin', id: 'p1', name: 'Mivida' }) } });
  await waitFor(() => expect(screen.getByText('MV-1')).toBeTruthy());
  fireEvent.press(screen.getByText('MV-1'));
  expect(mockNavigate).toHaveBeenCalledWith('Unit', { code: 'MV-1' });
});

test('a filter asks the server again', async () => {
  mocked.map.mockResolvedValue(data);
  await wrap();
  await waitFor(() => expect(screen.getByTestId('map-deal')).toBeTruthy());
  fireEvent.press(screen.getByText(/^Sale$|^بيع$/));
  await waitFor(() => expect(mocked.map).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'sale' })));
});

test('the filter panel sends type, finishing, furnishing and the budget as numbers', async () => {
  mocked.map.mockResolvedValue(data);
  await wrap();
  await waitFor(() => expect(screen.getByTestId('map-filters-toggle')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('map-filters-toggle'));
  await waitFor(() => expect(screen.getByTestId('map-pmax')).toBeTruthy());
  await fireEvent.changeText(screen.getByTestId('map-pmax'), '6m');
  await fireEvent.changeText(screen.getByTestId('map-pmin'), '250k');
  await fireEvent.press(screen.getByText(/^Fully finished$|^تشطيب كامل$/));
  await waitFor(() => expect(mocked.map).toHaveBeenLastCalledWith(expect.objectContaining({ pmax: 6e6, pmin: 250e3, fin: 'fully_finished' })));
  await fireEvent.press(screen.getByTestId('map-reset'));
  await waitFor(() => expect(mocked.map).toHaveBeenLastCalledWith(expect.not.objectContaining({ fin: 'fully_finished' })));
});

test('typing a place name suggests it from the phone list and picking it fills the box', async () => {
  mocked.map.mockResolvedValue(data);
  usePlaces.setState({
    list: {
      version: 'v1',
      areas: [],
      places: [{ id: 'p1', name_en: 'Mivida', name_ar: 'ميفيدا', aliases: [], area_id: null, subzone_id: null, lat: 30, lng: 31.5 }],
    },
    pending: [],
  });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('map-search')).toBeTruthy());
  await fireEvent.changeText(screen.getByTestId('map-search'), 'miv');
  await waitFor(() => expect(screen.getByTestId('map-place-p1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('map-place-p1'));
  await waitFor(() => expect(screen.queryByTestId('map-suggestions')).toBeNull());
  usePlaces.setState({ list: null });
});
