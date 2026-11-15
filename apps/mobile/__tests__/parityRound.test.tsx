import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DealForm } from '../src/components/DealForm';
import { SaveSearchButton } from '../src/components/SaveSearchButton';
import { CatalogueForms } from '../src/components/CatalogueForms';
import { SavedSearchesScreen } from '../src/screens/SavedSearchesScreen';
import { api } from '../src/api';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('../src/api', () => ({ api: { createDeal: jest.fn(), saveSearch: jest.fn(), savedSearches: jest.fn(), savedSearch: jest.fn(), deleteSavedSearch: jest.fn(), saveDeveloper: jest.fn(), saveProject: jest.fn() } }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

test('a deal is sent with one idem key and shows its reference', async () => {
  m.createDeal.mockResolvedValue({ ok: true, ref: 'D-0001', duplicate: false });
  await wrap(<DealForm lead="L-0001" />);
  await fireEvent.changeText(screen.getByTestId('deal-commission'), '2%');
  await fireEvent.press(screen.getByTestId('deal-save'));
  await waitFor(() => expect(m.createDeal).toHaveBeenCalledTimes(1));
  expect(m.createDeal.mock.calls[0][0]).toMatchObject({ lead: 'L-0001', commission: '2%', idem: expect.stringMatching(/^[0-9a-f]{16}$/) });
  await waitFor(() => expect(screen.getByText(/D-0001/)).toBeTruthy());
});

test('a search is saved under a name', async () => {
  m.saveSearch.mockResolvedValue({ ok: true, id: 'x' });
  await wrap(<SaveSearchButton f="tok" />);
  await fireEvent.press(screen.getByTestId('save-search'));
  await fireEvent.changeText(screen.getByTestId('save-search-name'), 'Hyde Park');
  await fireEvent.press(screen.getByTestId('save-search-go'));
  await waitFor(() => expect(m.saveSearch).toHaveBeenCalledWith('tok', 'Hyde Park', false));
});

test('a saved search can alert on new matches (a client request)', async () => {
  m.saveSearch.mockResolvedValue({ ok: true, id: 'x' });
  await wrap(<SaveSearchButton f="tok" />);
  await fireEvent.press(screen.getByTestId('save-search'));
  await fireEvent.changeText(screen.getByTestId('save-search-name'), 'Client A');
  await fireEvent(screen.getByTestId('save-search-alerts'), 'valueChange', true);
  await fireEvent.press(screen.getByTestId('save-search-go'));
  await waitFor(() => expect(m.saveSearch).toHaveBeenCalledWith('tok', 'Client A', true));
});

test('saved searches list, open and delete', async () => {
  m.savedSearches.mockResolvedValue({ items: [{ id: 's1', name: 'Hyde Park', total: 4, fresh: 1 }], max: 50 });
  m.savedSearch.mockResolvedValue({ name: 'Hyde Park', total: 4, items: [] });
  m.deleteSavedSearch.mockResolvedValue({ ok: true });
  await wrap(<SavedSearchesScreen />);
  await fireEvent.press(await screen.findByTestId('saved-s1'));
  await waitFor(() => expect(m.savedSearch).toHaveBeenCalledWith('s1'));
  await fireEvent.press(screen.getByTestId('saved-delete-s1'));
  await waitFor(() => expect(m.deleteSavedSearch).toHaveBeenCalledWith('s1'));
});

test('managers add a developer and a project', async () => {
  m.saveDeveloper.mockResolvedValue({ ok: true, id: 'd' });
  m.saveProject.mockResolvedValue({ ok: true, id: 'p' });
  await wrap(<CatalogueForms />);
  await fireEvent.press(screen.getByText('إضافة مطور'));
  await fireEvent.press(screen.getByText('إضافة مشروع'));
  const names = screen.getAllByLabelText('الاسم');
  await fireEvent.changeText(names[0], 'Talaat');
  await fireEvent.press(screen.getByTestId('developer-save'));
  await waitFor(() => expect(m.saveDeveloper).toHaveBeenCalledWith(expect.objectContaining({ name: 'Talaat' })));
  await fireEvent.changeText(names[1], 'Hyde Park');
  await fireEvent.press(screen.getByTestId('project-save'));
  await waitFor(() => expect(m.saveProject).toHaveBeenCalledWith(expect.objectContaining({ name: 'Hyde Park' })));
});
