import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UnitLifecycle } from '../src/components/UnitLifecycle';
import { UnitCard } from '../src/components/UnitCard';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { unitStatus: jest.fn(), unitDelete: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

test('marking a unit sold calls the server with the new status', async () => {
  m.unitStatus.mockResolvedValue({ ok: true, status: 'sold' });
  await wrap(<UnitLifecycle code="A-1" status="active" />);
  await fireEvent.press(screen.getByText('اتباعت'));
  await waitFor(() => expect(m.unitStatus).toHaveBeenCalledWith('A-1', 'sold'));
});

test('the unit card says sale or rent', async () => {
  const unit = { code: 'A-2', dealType: 'rent', compound: 'Mivida', price: 1, bedrooms: null, bathrooms: null, area: null, photo: null, mine: false } as never;
  await render(<UnitCard unit={unit} lang="en" onPress={() => undefined} />);
  expect(screen.getByTestId('deal-A-2')).toHaveTextContent('Rent');
});
