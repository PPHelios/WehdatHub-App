import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlaceInput } from '../src/components/PlaceInput';
import { AddUnitScreen } from '../src/screens/AddUnitScreen';
import { api } from '../src/api';
import * as draft from '../src/draft';
import { ApiClientError } from '@wehdathub/shared';

jest.mock('../src/api', () => ({ api: { placeSuggest: jest.fn(), extractUnit: jest.fn(), reviewUnit: jest.fn(), createUnit: jest.fn() } }));
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ replace: mockReplace }), useRoute: () => ({ params: undefined }) }));
jest.mock('../src/voice', () => ({ ensureMic: jest.fn().mockResolvedValue(true), startRecording: jest.fn(), stopRecording: jest.fn(), cancelRecording: jest.fn() }));
const m = api as unknown as { placeSuggest: jest.Mock; createUnit: jest.Mock };

const golden = { kind: 'subzone', id: 's1', name_en: 'Golden Square', name_ar: 'المربع الذهبي', path: 'New Cairo', via: 'name', area_id: 'a1', subzone_id: 's1' };
const hyde = { kind: 'compound', id: 'p1', name_en: 'Hyde Park', name_ar: 'هايد بارك', path: 'New Cairo › 5th Settlement', via: 'name', area_id: 'a1', subzone_id: 's5' };
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  await draft.clearDraft();
});

test('typing shows one list of compounds, areas and sub-zones, and a pick is handed on', async () => {
  m.placeSuggest.mockResolvedValue({ items: [golden, hyde] });
  const onPick = jest.fn();
  await wrap(<PlaceInput label="Compound" value="gol" onChangeText={() => {}} onPick={onPick} testID="p" />);
  await waitFor(() => expect(screen.getByTestId('place-suggestions')).toBeTruthy());
  expect(m.placeSuggest).toHaveBeenCalledWith('gol');
  await fireEvent.press(screen.getByTestId('place-p1'));
  expect(onPick).toHaveBeenCalledWith(hyde);
});

test('a short text asks for nothing', async () => {
  await wrap(<PlaceInput label="Compound" value="g" onChangeText={() => {}} onPick={() => {}} />);
  await new Promise<void>((r) => setTimeout(() => r(), 350));
  expect(m.placeSuggest).not.toHaveBeenCalled();
});

test('picking an area on the add-unit screen fills the area and empties the compound; clear removes it', async () => {
  m.placeSuggest.mockResolvedValue({ items: [golden] });
  await wrap(<AddUnitScreen />);
  await fireEvent.changeText(screen.getByTestId('f-compound'), 'gol');
  await waitFor(() => expect(screen.getByTestId('place-s1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('place-s1'));
  await waitFor(() => expect(screen.getByTestId('picked-area')).toBeTruthy());
  expect(screen.getByTestId('f-compound').props.value).toBe('');
  await fireEvent.press(screen.getByTestId('save-unit'));
  await waitFor(() => expect(m.createUnit).toHaveBeenCalled());
  expect(m.createUnit.mock.calls[0][0]).toMatchObject({ area_id: 'a1', subzone_id: 's1' });
  await fireEvent.press(screen.getByTestId('clear-area'));
  expect(screen.queryByTestId('picked-area')).toBeNull();
});

test('an unknown compound shows the names it looks like', async () => {
  m.createUnit.mockRejectedValue(new ApiClientError(422, 'compound_unknown', null, { suggestions: [{ name: 'Hyde Park' }, { name: 'Hyde Park Gardens' }] }));
  await wrap(<AddUnitScreen />);
  await fireEvent.press(screen.getByTestId('save-unit'));
  await waitFor(() => expect(screen.getByText(/Hyde Park \/ Hyde Park Gardens/)).toBeTruthy());
});
