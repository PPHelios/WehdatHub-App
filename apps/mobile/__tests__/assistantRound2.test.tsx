import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClientError, type AssistantQueryResponse, type SearchHomePriority } from '@wehdathub/shared';
import { AssistantCards } from '../src/components/AssistantCards';
import { HomeLeadActions } from '../src/components/HomeLeadActions';
import { TurnView, type TurnHandlers } from '../src/assistant/TurnView';
import { ViewingForm, prefillSlot } from '../src/components/ViewingForm';
import { useToastStore } from '../src/components/Toast';
import { reminderLine } from '../src/reminderLine';
import { api } from '../src/api';
import * as leadActions from '../src/leadActions';

jest.mock('../src/api', () => ({ api: { setViewing: jest.fn() } }));
jest.mock('../src/leadActions', () => ({ nudgeLead: jest.fn(), assignLead: jest.fn(), nudgeBroker: jest.fn() }));
const la = leadActions as unknown as Record<'nudgeLead' | 'assignLead' | 'nudgeBroker', jest.Mock>;
const toastText = () => useToastStore.getState().text;

beforeEach(() => { jest.clearAllMocks(); useToastStore.setState({ text: null, bad: false, n: 0 }); });

const AT = '2026-11-27T10:00:00.000Z';
const viewings = (extra: Record<string, unknown> = {}, split: unknown = { booked: 2, confirmed: 1, planned: 1 }): AssistantQueryResponse => ({
  intent: 'crm_viewings', headline: '3 viewings', aiUsed: false,
  cards: [{
    kind: 'stuck_leads', queue: 'viewings', total: 3, canAssign: false, canNudge: true, recommendedBrokers: [], ...(split ? { split } : {}), ...extra,
    items: [
      { ref: 'L-1', name: 'Sara', stage: 'viewing', assignee: 'Nour', assigneeId: 'b1', createdAt: null, viewingState: 'booked', at: AT, lastAutoReminderAt: AT },
      { ref: 'L-2', name: 'Omar', stage: 'viewing', assignee: 'Nour', assigneeId: 'b1', createdAt: null, viewingState: 'confirmed', at: AT, lastAutoReminderAt: null },
      { ref: 'L-3', name: 'Mona', stage: 'viewing', assignee: 'Nour', assigneeId: 'b1', createdAt: null, viewingState: 'planned', at: AT, action: { kind: 'book_viewing', ref: 'L-3', at: AT } },
    ],
  }] as never,
});
const cards = (response: AssistantQueryResponse, props: Partial<React.ComponentProps<typeof AssistantCards>> = {}) => render(
  <AssistantCards response={response} query="q" ar={false} onAssignLead={jest.fn()} onNudgeLead={jest.fn().mockResolvedValue(undefined)} onOpenLead={jest.fn()} onOpenUnit={jest.fn()}
    onPivotPrimary={jest.fn()} onNavigateLink={jest.fn()} onOpenQueue={jest.fn()} {...props} />,
);

test('viewings card: split line, a state pill per item, Book it only for planned, no warning', async () => {
  const onBookViewing = jest.fn();
  await cards(viewings(), { onBookViewing });
  expect(screen.getByTestId('viewings-split')).toHaveTextContent('2 on the calendar (1 confirmed by client) · 1 follow-up only');
  expect(screen.getByTestId('viewing-state-L-1')).toHaveTextContent('On calendar');
  expect(screen.getByTestId('viewing-state-L-2')).toHaveTextContent('Client confirmed');
  expect(screen.getByTestId('viewing-state-L-3')).toHaveTextContent('Follow-up only');
  expect(screen.queryByTestId('assistant-book-L-1')).toBeNull();
  expect(screen.queryByText(/not confirmed/i)).toBeNull();
  await fireEvent.press(screen.getByTestId('assistant-book-L-3'));
  expect(onBookViewing).toHaveBeenCalledWith('L-3', AT);
});

test('old server viewings payload (no split, states, reminders) still renders', async () => {
  const old = viewings({}, null);
  (old.cards[0] as { items: Record<string, unknown>[] }).items = [{ ref: 'L-9', name: 'Old', stage: 'new', assignee: 'Nour', assigneeId: 'b1', createdAt: null }];
  await cards(old);
  expect(screen.queryByTestId('viewings-split')).toBeNull();
  expect(screen.queryByTestId('viewing-state-L-9')).toBeNull();
  expect(screen.queryByTestId('auto-reminded-L-9')).toBeNull();
  expect(screen.getByText(/L-9/)).toBeTruthy();
});

test('viewing items get a nudge button and a muted auto-reminder line only when there was one', async () => {
  const onNudgeLead = jest.fn().mockResolvedValue(undefined);
  await cards(viewings(), { onNudgeLead });
  expect(screen.getByTestId('auto-reminded-L-1')).toHaveTextContent(/Auto-reminded (at|on)/);
  expect(screen.queryByTestId('auto-reminded-L-2')).toBeNull();
  await fireEvent.press(screen.getByTestId('assistant-nudge-L-2'));
  await waitFor(() => expect(onNudgeLead).toHaveBeenCalledWith('L-2'));
});

test('reminderLine: Cairo time today, date on another day, null without a time', () => {
  const now = new Date('2026-11-27T12:00:00Z');
  expect(reminderLine('2026-11-27T13:10:00Z', 'en', now)).toMatch(/^Auto-reminded at 15:10/);
  expect(reminderLine('2026-11-25T13:10:00Z', 'en', now)).toMatch(/^Auto-reminded on /);
  expect(reminderLine('2026-11-27T13:10:00Z', 'ar', now)).toContain('اتفكّر تلقائي الساعة');
  expect(reminderLine(null, 'en', now)).toBeNull();
});

test('open-list button follows card.queue; none when the queue is null', async () => {
  const onOpenQueue = jest.fn();
  const { unmount } = await cards(viewings(), { onOpenQueue });
  await fireEvent.press(screen.getByTestId('card-open-list'));
  expect(onOpenQueue).toHaveBeenCalledWith('viewings');
  await unmount();
  await cards(viewings({ queue: null }), { onOpenQueue });
  expect(screen.queryByTestId('card-open-list')).toBeNull();
  expect(screen.getByTestId('card-stuck-leads')).toBeTruthy();
});

const discipline = (): AssistantQueryResponse => ({
  intent: 'crm_discipline', headline: 'Team', aiUsed: false,
  cards: [{ kind: 'broker_discipline', summary: { consistent: 1, lagging: 2, silent: 0, totalNoNextStep: 0, totalMissed: 0 }, rows: [
    { id: 'u1', brokerId: 'b1', name: 'Nour', canNudgeBroker: true, leads: 1, contacted: 1, forward: 0, deals: 0, commission: 0, discipline: 'lagging' },
    { id: 'u2', brokerId: 'b2', name: 'Tarek', canNudgeBroker: true, leads: 1, contacted: 1, forward: 0, deals: 0, commission: 0, discipline: 'lagging' },
    { id: 'u3', brokerId: 'b3', name: 'Me', canNudgeBroker: false, leads: 1, contacted: 1, forward: 0, deals: 0, commission: 0 },
  ] }] as never,
});

test('discipline: per-broker Nudge shows a toast; no button when canNudgeBroker is false', async () => {
  const onNudgeBroker = jest.fn().mockResolvedValue(undefined);
  await cards(discipline(), { onNudgeBroker });
  expect(screen.queryByTestId('assistant-nudge-broker-b3')).toBeNull();
  await fireEvent.press(screen.getByTestId('assistant-nudge-broker-b1'));
  await waitFor(() => expect(onNudgeBroker).toHaveBeenCalledWith('b1'));
  await waitFor(() => expect(toastText()).toBe('Nudge sent'));
});

test('discipline: 429 on one broker shows the already-nudged toast', async () => {
  const onNudgeBroker = jest.fn().mockRejectedValue(new ApiClientError(429, 'rate_limited'));
  await cards(discipline(), { onNudgeBroker });
  await fireEvent.press(screen.getByTestId('assistant-nudge-broker-b1'));
  await waitFor(() => expect(toastText()).toBe('Already nudged recently'));
});

test('Nudge all sends one after another and shows one summary toast', async () => {
  const order: string[] = [];
  const onNudgeBroker = jest.fn(async (id: string) => { order.push(id); if (id === 'b2') throw new ApiClientError(429, 'rate_limited'); });
  await cards(discipline(), { onNudgeBroker });
  await fireEvent.press(screen.getByTestId('assistant-nudge-all'));
  await waitFor(() => expect(toastText()).toBe('1 nudged · 1 nudged recently'));
  expect(order).toEqual(['b1', 'b2']);
});

test('old discipline payload (no canNudgeBroker) has no nudge buttons', async () => {
  const old = discipline();
  (old.cards[0] as { rows: Record<string, unknown>[] }).rows.forEach((r) => { delete r.canNudgeBroker; delete r.brokerId; });
  await cards(old, { onNudgeBroker: jest.fn() });
  expect(screen.queryByTestId('assistant-nudge-all')).toBeNull();
  expect(screen.queryByTestId('assistant-nudge-broker-u1')).toBeNull();
});

test('client_matches rows show name, broker, wants and unit count; tap opens the lead', async () => {
  const onOpenLead = jest.fn();
  await cards({
    intent: 'crm_client_matches', headline: '2 clients', aiUsed: false,
    cards: [{ kind: 'client_matches', title: 'Clients who want this', total: 1, queue: null, items: [{ ref: 'L-7', name: 'Hany', brokerName: 'Nour', brokerId: 'b1', wants: '3BR in Mivida up to 8M', matchCount: 4 }] }],
  }, { onOpenLead });
  expect(screen.getByText('Hany')).toBeTruthy();
  expect(screen.getByText('Nour')).toBeTruthy();
  expect(screen.getByText('3BR in Mivida up to 8M')).toBeTruthy();
  expect(screen.getByText('4 matching units')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('client-match-L-7'));
  expect(onOpenLead).toHaveBeenCalledWith('L-7');
});

test('unknown card kinds still fall back to the text answer', async () => {
  await cards({ intent: 'x', headline: 'h', aiUsed: false, cards: [{ kind: 'brand_new_kind', summary: 'fallback text' } as never] });
  expect(screen.getByText('fallback text')).toBeTruthy();
});

const handlers = (onSend = jest.fn()): TurnHandlers => ({ onSend, onRetry: jest.fn(), onRate: jest.fn(), onOpenReport: jest.fn(), onSearchAnyway: jest.fn(), onSeeAll: jest.fn(), onOpenUnit: jest.fn(), onOpenProject: jest.fn(), onUseFilters: jest.fn(),
  cards: { onAssignLead: jest.fn(), onNudgeLead: jest.fn(), onOpenLead: jest.fn(), onOpenUnit: jest.fn(), onPivotPrimary: jest.fn(), onNavigateLink: jest.fn(), onOpenQueue: jest.fn() } });
const clarifyTurn = (kind?: string) => ({ id: 't1', question: 'عميل شقة', source: 'typed' as const, status: 'done' as const, response: {
  intent: 'clarify', route: 'clarify', clarifyKind: kind, headline: 'Which one?', aiUsed: false, cards: [],
  suggestions: [{ label: 'Find units', q: 'وحدات: عميل شقة' }, { label: 'Show clients', q: 'عملاء: عميل شقة' }] } });

test('units_or_clients clarify renders two real buttons that send the prefixed question', async () => {
  const onSend = jest.fn();
  await render(<TurnView turn={clarifyTurn('units_or_clients') as never} lang="en" index={0} handlers={handlers(onSend)} />);
  expect(screen.getByTestId('clarify-choice')).toBeTruthy();
  expect(screen.queryByTestId('suggestions')).toBeNull();
  await fireEvent.press(screen.getByTestId('clarify-choice-1'));
  expect(onSend).toHaveBeenCalledWith('عملاء: عميل شقة', 'chip');
});

test('other clarify kinds keep the suggestion chips', async () => {
  await render(<TurnView turn={clarifyTurn() as never} lang="en" index={0} handlers={handlers()} />);
  expect(screen.getByTestId('suggestions')).toBeTruthy();
  expect(screen.queryByTestId('clarify-choice')).toBeNull();
});

const lead = { ref: 'L-0001', name: 'Sara', phones: ['201011112222'], kind: 'buyer', stage: 'new', version: 3 };
const wrapForm = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

test('after saving: send-to-client button opens the wa link, Done closes; hidden when wa is null', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  (api as unknown as { setViewing: jest.Mock }).setViewing.mockResolvedValue({ lead, viewing: { id: 'v', startsAt: AT, place: null, status: 'proposed' }, url: 'u', message: 'Hello', wa: 'https://wa.me/1?text=x' });
  const { unmount } = await wrapForm(<ViewingForm lead={lead as never} />);
  await fireEvent.press(screen.getByTestId('viewing-save'));
  await waitFor(() => expect(screen.getByTestId('viewing-send')).toBeTruthy());
  expect(open).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('viewing-send'));
  expect(open).toHaveBeenCalledWith('https://wa.me/1?text=x');
  await fireEvent.press(screen.getByTestId('viewing-finish'));
  expect(screen.queryByTestId('viewing-done')).toBeNull();
  await unmount();

  (api as unknown as { setViewing: jest.Mock }).setViewing.mockResolvedValue({ lead, viewing: { id: 'v', startsAt: AT, place: null, status: 'proposed' }, url: 'u', message: 'Hello', wa: null });
  await wrapForm(<ViewingForm lead={lead as never} />);
  await fireEvent.press(screen.getByTestId('viewing-save'));
  await waitFor(() => expect(screen.getByTestId('viewing-done')).toBeTruthy());
  expect(screen.queryByTestId('viewing-send')).toBeNull();
});

test('prefillSlot turns a planned time into the form day and hour', () => {
  const now = new Date(2026, 10, 27, 8, 0);
  expect(prefillSlot(new Date(2026, 10, 29, 15, 20).toISOString(), now)).toEqual({ day: 2, hour: 15 });
  expect(prefillSlot('nonsense', now)).toBeNull();
  expect(prefillSlot(undefined, now)).toBeNull();
});

const prio = (over: Partial<SearchHomePriority> = {}): SearchHomePriority => ({ id: 'waiting-over-1h', urgency: 'high', count: 3, action: { kind: 'queue', queue: 'waiting-over-1h' }, canNudge: true, canAssign: true,
  lead: { ref: 'L-5', version: 2, assigneeId: 'b1', lastAutoReminderAt: AT, recommendedBroker: { id: 'b2', name: 'Tarek' } }, ...over });
const home = (p: SearchHomePriority) => render(<QueryClientProvider client={new QueryClient()}><HomeLeadActions p={p} lang="en" /></QueryClientProvider>);

test('Home card: nudge and assign call the same actions, with a toast', async () => {
  la.nudgeLead.mockResolvedValue(undefined);
  la.assignLead.mockResolvedValue(undefined);
  await home(prio());
  expect(screen.getByTestId('waiting-over-1h-auto')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('waiting-over-1h-nudge'));
  await waitFor(() => expect(la.nudgeLead).toHaveBeenCalledWith('L-5'));
  await waitFor(() => expect(toastText()).toBe('Nudge sent'));
  await fireEvent.press(screen.getByTestId('waiting-over-1h-assign'));
  await waitFor(() => expect(la.assignLead).toHaveBeenCalledWith(expect.anything(), 'L-5', 'b2', 2));
});

test('Home card: 429 shows the already-nudged toast', async () => {
  la.nudgeLead.mockRejectedValue(new ApiClientError(429, 'rate_limited'));
  await home(prio());
  await fireEvent.press(screen.getByTestId('waiting-over-1h-nudge'));
  await waitFor(() => expect(toastText()).toBe('Already nudged recently'));
});

test('Home card: nothing without the right, without a lead (old server), or for other cards', async () => {
  const none = (p: SearchHomePriority) => home(p).then((r) => { const empty = r.toJSON() === null; r.unmount(); return empty; });
  expect(await none(prio({ canNudge: false, canAssign: false }))).toBe(true);
  expect(await none(prio({ lead: undefined }))).toBe(true);
  expect(await none(prio({ id: 'commissions' }))).toBe(true);
  await act(async () => undefined);
});
