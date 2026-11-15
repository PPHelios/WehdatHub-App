import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PipelineScreen } from '../src/screens/PipelineScreen';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { leadCounts: jest.fn(), team: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
const m = api as unknown as Record<string, jest.Mock>;

test('shows the count of every stage', async () => {
  m.leadCounts.mockResolvedValue({ counts: { new: 4, contacted: 2, interested: 0, viewing: 1, negotiation: 0, won: 3, lost: 5, due_today: 2, overdue: 1, no_next_step: 0 } });
  m.team.mockResolvedValue({ items: [] });
  await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PipelineScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTestId('pipe-new')).toBeTruthy());
  expect(screen.getByText('5')).toBeTruthy();
});
