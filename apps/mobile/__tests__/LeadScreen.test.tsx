import React from 'react';
import { Linking, StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClientError, ltr } from '@wehdathub/shared';
import { LeadScreen } from '../src/screens/LeadScreen';
import { api } from '../src/api';

jest.mock('../src/api', () => ({ api: { lead: jest.fn(), leadCalled: jest.fn(), leadStage: jest.fn(), leadFollowUp: jest.fn(), leadNote: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useRoute: () => ({ params: { ref: 'L-0001' } }), useNavigation: () => ({ goBack: jest.fn() }) }));
const m = api as unknown as Record<string, jest.Mock>;
const lead = { ref: 'L-0001', name: 'Sara', phones: ['201012345678'], kind: 'buyer', stage: 'new', lostReason: null, source: 'Web', notes: null, nextFollowUpAt: null, followUpKind: null, followUpNote: null, lastContactAt: null, assignee: null, version: 3 };

const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LeadScreen /></QueryClientProvider>);
beforeEach(() => {
  jest.clearAllMocks();
  m.lead.mockResolvedValue({ lead, timeline: [] });
});

test('I called sends the version the screen shows', async () => {
  m.leadCalled.mockResolvedValue({ lead: { ...lead, version: 4 } });
  await wrap();
  await waitFor(() => expect(screen.getByTestId('lead-called')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('lead-called'));
  await waitFor(() => expect(m.leadCalled).toHaveBeenCalledWith('L-0001', 3));
});

test('the stage panel opens the lead without a message language control', async () => {
  await wrap();
  expect(await screen.findByTestId('lead-stage-panel')).toBeTruthy();
  expect(screen.queryByTestId('lead-lang')).toBeNull();
});

test('a change made elsewhere shows a clear message and reloads', async () => {
  m.leadCalled.mockRejectedValue(new ApiClientError(409, 'conflict'));
  await wrap();
  await waitFor(() => expect(screen.getByTestId('lead-called')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('lead-called'));
  await waitFor(() => expect(screen.getByTestId('lead-message')).toBeTruthy());
  expect(m.lead.mock.calls.length).toBeGreaterThan(1);
});

test('lead contact actions keep the number readable and open the right call and chat links', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await wrap();
  await waitFor(() => expect(screen.getByTestId('whatsapp-201012345678')).toBeTruthy());
  const phone = screen.getByTestId('lead-phone-201012345678');
  expect(phone.props.children).toBe(ltr('201012345678'));
  expect(StyleSheet.flatten(phone.parent?.props.style).direction).toBe('ltr');
  await fireEvent.press(screen.getByTestId('call-201012345678'));
  await fireEvent.press(screen.getByTestId('whatsapp-201012345678'));
  await waitFor(() => expect(open).toHaveBeenCalledWith('tel:+201012345678'));
  expect(open).toHaveBeenCalledWith('https://wa.me/201012345678');
  open.mockRestore();
});

test('scheduling actions open their pickers without standalone messaging controls', async () => {
  m.leadFollowUp.mockResolvedValue({ lead });
  await wrap();
  await screen.findByTestId('lead-note');
  expect(screen.queryByTestId('sec-draft')).toBeNull();
  expect(screen.queryByTestId('sec-send')).toBeNull();
  expect(screen.queryByTestId('fu-picker')).toBeNull();
  expect(screen.queryByTestId('viewing-save')).toBeNull();

  await fireEvent.press(screen.getByTestId('fu-pick'));
  expect(screen.getByTestId('fu-picker')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('fu-save'));
  await waitFor(() => expect(m.leadFollowUp).toHaveBeenCalledWith('L-0001', 3, expect.any(String), 'call'));

  await fireEvent.press(screen.getByTestId('sec-viewing'));
  expect(screen.getByTestId('viewing-save')).toBeTruthy();
});
