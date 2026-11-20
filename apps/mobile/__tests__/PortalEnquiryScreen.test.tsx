import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalEnquiryScreen } from '../src/screens/PortalEnquiryScreen';
import { api } from '../src/api';

const mockReplace = jest.fn();
const mockParams = { message: 'new enquiry on Nawy', enquiry: { portal: 'Nawy', name: 'Khaled', link: 'https://nawy.com/x/503956661', listingNo: '503956661' } };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ replace: mockReplace }), useRoute: () => ({ params: mockParams }) }));
jest.mock('../src/api', () => ({ api: { team: jest.fn(), readPortalEnquiry: jest.fn(), savePortalEnquiry: jest.fn() } }));
const m = api as unknown as Record<string, jest.Mock>;
const wrap = async (ui: React.ReactElement) => await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  m.team.mockResolvedValue({ items: [{ id: 'b1', name: 'Sara', role: 'broker', me: false, away: false, open: 2, overdue: 0, soon: 0 }] });
});

test('shows the parsed enquiry and saves it with phone and broker as a lead', async () => {
  m.savePortalEnquiry.mockResolvedValue({ id: 'e1', deduped: false, assigned: true, leadRef: 'L-0007' });
  await wrap(<PortalEnquiryScreen />);
  expect(screen.getByTestId('pe-listing').props.children.join('')).toContain('503956661');
  await fireEvent.changeText(screen.getByTestId('pe-phone'), '01012345678');
  await waitFor(() => expect(screen.getByText('Sara')).toBeTruthy());
  await fireEvent.press(screen.getByText('Sara'));
  await fireEvent.press(screen.getByTestId('pe-save'));
  await waitFor(() => expect(m.savePortalEnquiry).toHaveBeenCalledWith({ message: 'new enquiry on Nawy', phone: '01012345678', brokerId: 'b1' }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('Lead', { ref: 'L-0007' }));
});

test('a phone without a broker is not sent', async () => {
  await wrap(<PortalEnquiryScreen />);
  await fireEvent.changeText(screen.getByTestId('pe-phone'), '01012345678');
  await fireEvent.press(screen.getByTestId('pe-save'));
  await waitFor(() => expect(screen.getByTestId('pe-error')).toBeTruthy());
  expect(m.savePortalEnquiry).not.toHaveBeenCalled();
});
