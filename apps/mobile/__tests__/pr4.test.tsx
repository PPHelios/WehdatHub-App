import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClientError } from '@wehdathub/shared';
import { AskScreen } from '../src/screens/AskScreen';
import { TeamScreen } from '../src/screens/TeamScreen';
import { AddUnitScreen, EXISTING, photoChanges } from '../src/screens/AddUnitScreen';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { ask: jest.fn(), team: jest.fn(), unit: jest.fn(), unitEditFields: jest.fn(), saveUnitEdit: jest.fn(), unitPhotos: jest.fn(), extractUnit: jest.fn(), voiceToText: jest.fn() } }));
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn(), replace: jest.fn() }), useRoute: () => ({ params: { edit: 'A-1' } }) }));
jest.mock('../src/voice', () => ({ ensureMic: jest.fn().mockResolvedValue(true), startRecording: jest.fn(), stopRecording: jest.fn() }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => jest.clearAllMocks());

test('photo changes: new files, removed ids and the kept order', () => {
  const list = [
    { uri: 'u2', name: 'b', type: EXISTING },
    { uri: 'file://new.jpg', name: 'n.jpg', type: 'image/jpeg' },
    { uri: 'u1', name: 'a', type: EXISTING },
  ];
  const ch = photoChanges(['a', 'b', 'c'], list);
  expect(ch.remove).toEqual(['c']);
  expect(ch.order).toEqual(['b', 'a']);
  expect(ch.add).toHaveLength(1);
  expect(ch.changed).toBe(true);
  expect(photoChanges(['a', 'b'], [{ uri: 'u1', name: 'a', type: EXISTING }, { uri: 'u2', name: 'b', type: EXISTING }]).changed).toBe(false);
});

test('saving an edited unit sends the photo changes after the fields', async () => {
  m.unit.mockResolvedValue({ images: [{ id: 'a', url: 'https://x/a.jpg', position: 0 }, { id: 'b', url: 'https://x/b.jpg', position: 1 }] });
  m.unitEditFields.mockResolvedValue({ code: 'A-1', version: 2, fields: { compound: 'Mivida' } });
  m.saveUnitEdit.mockResolvedValue({ code: 'A-1', version: 3 });
  m.unitPhotos.mockResolvedValue({ images: [], failed: 0 });
  await wrap(<AddUnitScreen />);
  await waitFor(() => expect(screen.getByTestId('photo-row-1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('photo-remove-1'));
  await fireEvent.press(screen.getByTestId('save-unit'));
  await waitFor(() => expect(m.saveUnitEdit).toHaveBeenCalled());
  await waitFor(() => expect(m.unitPhotos).toHaveBeenCalledWith('A-1', expect.objectContaining({ remove: ['b'], order: ['a'] })));
});

test('ask shows the answer and the data dates; a blocked AI shows the server message', async () => {
  m.ask.mockResolvedValueOnce({ answer: 'Delivery is 2028.', found: true, lang: 'en', dataDates: 'Data: Badya prices 2026-10-01' });
  await wrap(<AskScreen />);
  await fireEvent.changeText(screen.getByTestId('ask-input'), 'when is delivery');
  await fireEvent.press(screen.getByTestId('ask-go'));
  await waitFor(() => expect(screen.getByTestId('ask-answer')).toBeTruthy());
  expect(screen.getByText(/2028/)).toBeTruthy();
  m.ask.mockRejectedValueOnce(new ApiClientError(402, 'ai_blocked', null, { message: 'Out of credits' }));
  await fireEvent.press(screen.getByTestId('ask-go'));
  await waitFor(() => expect(screen.getByText('Out of credits')).toBeTruthy());
  expect(screen.queryByTestId('ask-answer')).toBeNull();
});

test('the team lists each broker with the open and overdue counts', async () => {
  m.team.mockResolvedValue({ items: [{ id: 'b1', name: 'Sara', role: 'broker', me: false, away: false, open: 4, overdue: 2, soon: 1 }] });
  await wrap(<TeamScreen />);
  await waitFor(() => expect(screen.getByTestId('member-b1')).toBeTruthy());
  expect(screen.getByText(/Sara/)).toBeTruthy();
  expect(screen.getByText(/^2 /)).toBeTruthy();
});
