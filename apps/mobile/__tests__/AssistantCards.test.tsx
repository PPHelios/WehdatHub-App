import React from 'react';
import { Share } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiClientError, type AssistantQueryResponse } from '@wehdathub/shared';
import { AssistantCards } from '../src/components/AssistantCards';

const noop = async () => undefined;

test('renders Option B stuck_leads with Smart Reassign, Ask for update nudge, 429 inline error, and non-PII share summary', async () => {
  const onAssignLead = jest.fn().mockResolvedValue(undefined);
  const onNudgeLead = jest
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new ApiClientError(429, 'too_many', null, { message: 'Already nudged within 2h' }));
  const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });

  const response: AssistantQueryResponse = {
    intent: 'crm_leads',
    headline: 'Leads waiting > 1h · 2',
    windowLabel: 'Live queue',
    aiUsed: false,
    suggestPrimary: true,
    cards: [
      {
        kind: 'stuck_leads',
        queue: 'waiting-over-1h',
        total: 2,
        canAssign: true,
        canNudge: true,
        recommendedBrokers: [
          { id: 'b2', name: 'Nour', open: 1 },
          { id: 'b1', name: 'Sara', open: 5 },
        ],
        items: [
          { ref: 'L-0041', name: 'Secret Client Name', stage: 'new', version: 2, assignee: 'Sara', assigneeId: 'b1', createdAt: null },
          { ref: 'L-0042', name: 'Second Client', stage: 'new', version: 1, assignee: 'Tarek', assigneeId: 'b3', createdAt: null },
        ],
      },
      {
        kind: 'broker_scorecard',
        broker: {
          id: 'b1',
          name: 'Sara',
          leads: 10,
          contacted: 8,
          forward: 5,
          deals: 2,
          commission: 50000,
          open: 4,
          updates: 12,
          updates48h: 2,
          noNextStep: 1,
          missed: 0,
          discipline: 'consistent',
          telegramLinked: false,
          responseMin: 15,
        },
      },
      {
        kind: 'metric_row',
        items: [
          { label: 'Commission', value: 50000, tone: 'ok', unit: 'EGP' },
          { label: 'Overdue', value: 0, tone: 'neutral' },
        ],
      },
      {
        kind: 'bar_breakdown',
        title: 'By source',
        rows: [{ key: 'meta', label: 'Meta Ads', count: 6, valueLabel: '6 · 2d' }],
      },
    ],
  };

  const onPivotPrimary = jest.fn();
  await render(
    <AssistantCards
      response={response}
      query="apartments in Mivida"
      ar={false}
      onAssignLead={onAssignLead}
      onNudgeLead={onNudgeLead}
      onOpenLead={jest.fn()}
      onOpenUnit={jest.fn()}
      onPivotPrimary={onPivotPrimary}
      onNavigateLink={jest.fn()}
      onOpenQueue={jest.fn()}
    />,
  );

  expect(screen.getByTestId('card-stuck-leads')).toBeTruthy();
  expect(screen.getByTestId('card-broker-scorecard')).toBeTruthy();
  expect(screen.getByTestId('card-metric-row')).toBeTruthy();
  expect(screen.getByText('Overdue')).toBeTruthy();
  expect(screen.queryByText('0 EGP')).toBeNull();
  expect(screen.getByTestId('card-bar-breakdown')).toBeTruthy();
  expect(screen.getByText('6 · 2d')).toBeTruthy();

  // Smart Reassign recommends Nour (not current assignee Sara for L-0041).
  expect(screen.queryByTestId('assistant-reassign-L-0041-b1')).toBeNull();
  await fireEvent.press(screen.getByTestId('assistant-reassign-L-0041-b2'));
  await waitFor(() => expect(onAssignLead).toHaveBeenCalledWith('L-0041', 'b2', 2));

  // Ask for update triggers nudge and handles 429 cleanly.
  await fireEvent.press(screen.getByTestId('assistant-nudge-L-0041'));
  await waitFor(() => expect(onNudgeLead).toHaveBeenCalledWith('L-0041'));
  await fireEvent.press(screen.getByTestId('assistant-nudge-L-0042'));
  await waitFor(() => expect(screen.getByTestId('assistant-action-error')).toBeTruthy());

  // Share Summary excludes client PII names/phones.
  await fireEvent.press(screen.getByTestId('assistant-share-summary'));
  expect(shareSpy).toHaveBeenCalled();
  const sharedMsg = String(shareSpy.mock.calls[0][0].message);
  expect(sharedMsg).toContain('Leads waiting > 1h');
  expect(sharedMsg).not.toContain('Secret Client Name');

  // Primary pivot triggers 1-tap callback.
  await fireEvent.press(screen.getByTestId('assistant-pivot-primary'));
  expect(onPivotPrimary).toHaveBeenCalledWith('apartments in Mivida');
});

test('renders broker_discipline and text_answer cards cleanly', async () => {
  await render(
    <AssistantCards
      response={{
        intent: 'crm_discipline',
        headline: '1 silent broker(s)',
        aiUsed: false,
        cards: [
          {
            kind: 'broker_discipline',
            summary: { consistent: 1, lagging: 0, silent: 1, totalNoNextStep: 2, totalMissed: 1 },
            rows: [
              { id: 'b9', name: 'Khaled', leads: 4, contacted: 1, forward: 0, deals: 0, commission: 0, updates48h: 0, noNextStep: 2, missed: 1, discipline: 'silent', telegramLinked: false },
            ],
          },
          { kind: 'text_answer', answer: 'Project facts answer', dataDates: null, found: true, source: 'local' },
        ],
      }}
      query="who is not updating?"
      ar={false}
      onAssignLead={noop}
      onNudgeLead={noop}
      onOpenLead={jest.fn()}
      onOpenUnit={jest.fn()}
      onPivotPrimary={jest.fn()}
      onNavigateLink={jest.fn()}
      onOpenQueue={jest.fn()}
    />,
  );
  expect(screen.getByTestId('card-broker-discipline')).toBeTruthy();
  expect(screen.getByTestId('card-text-answer')).toBeTruthy();
  expect(screen.getByText('Khaled')).toBeTruthy();
});

test('per-lead action lock blocks same-lead double-tap before render, allows concurrent different lead, and shows 409 error inline per row', async () => {
  let resolveA!: () => void;
  let rejectB!: (err: Error) => void;
  const onAssignLead = jest.fn()
    .mockImplementationOnce(() => new Promise<void>((res) => { resolveA = res; }))
    .mockImplementationOnce(() => new Promise<void>((_, rej) => { rejectB = rej; }));

  const response: AssistantQueryResponse = {
    intent: 'crm_leads',
    headline: '2 overdue leads',
    aiUsed: false,
    cards: [{
      kind: 'stuck_leads',
      queue: 'overdue',
      total: 2,
      canAssign: true,
      canNudge: true,
      recommendedBrokers: [{ id: 'b2', name: 'Nour', open: 1 }],
      items: [
        { ref: 'L-0041', name: 'Client A', stage: 'new', version: 2, assignee: 'Sara', assigneeId: 'b1', createdAt: null },
        { ref: 'L-0042', name: 'Client B', stage: 'new', version: 3, assignee: 'Sara', assigneeId: 'b1', createdAt: null },
      ],
    }],
  };

  await render(
    <AssistantCards
      response={response}
      query="overdue"
      ar={false}
      onAssignLead={onAssignLead}
      onNudgeLead={noop}
      onOpenLead={jest.fn()}
      onOpenUnit={jest.fn()}
      onPivotPrimary={jest.fn()}
      onNavigateLink={jest.fn()}
      onOpenQueue={jest.fn()}
    />,
  );

  // Tapping L-0041 twice while pending invokes onAssignLead only once.
  const btn41 = screen.getByTestId('assistant-reassign-L-0041-b2');
  await fireEvent.press(btn41);
  await fireEvent.press(btn41);
  expect(onAssignLead).toHaveBeenCalledTimes(1);

  // Tapping L-0042 while L-0041 is still pending succeeds independently.
  await fireEvent.press(screen.getByTestId('assistant-reassign-L-0042-b2'));
  expect(onAssignLead).toHaveBeenCalledTimes(2);
  expect(onAssignLead).toHaveBeenNthCalledWith(1, 'L-0041', 'b2', 2);
  expect(onAssignLead).toHaveBeenNthCalledWith(2, 'L-0042', 'b2', 3);

  await act(async () => {
    resolveA();
    rejectB(new ApiClientError(409, 'conflict'));
    await Promise.resolve();
  });
  expect(await screen.findByTestId('assistant-row-error-L-0042')).toBeTruthy();
  expect(screen.queryByTestId('assistant-row-error-L-0041')).toBeNull();
});

test('renders understood appliedFilters, deliberate view_all_markets action, Change search action, and distinct clarify state without noResults', async () => {
  const onViewAllMarkets = jest.fn();
  const onChangeSearch = jest.fn();
  await render(
    <AssistantCards
      response={{
        intent: 'clarify',
        headline: 'Which market did you mean?',
        windowLabel: 'Resale vs Primary',
        aiUsed: false,
        understood: {
          job: 'find_units',
          market: null,
          appliedFilters: ['Area: Zayed', 'Down payment: 1M'],
          exclusions: [],
          unsupportedFilters: ['down_payment'],
        },
        cards: [],
        actions: [
          { kind: 'view_all_markets', label: 'View all markets' },
          { kind: 'pivot_mode', mode: 'primary', label: 'Search developer projects' },
        ],
      }}
      query="apartments in zayed down payment 1m"
      ar={false}
      onAssignLead={noop}
      onNudgeLead={noop}
      onOpenLead={jest.fn()}
      onOpenUnit={jest.fn()}
      onPivotPrimary={jest.fn()}
      onNavigateLink={jest.fn()}
      onOpenQueue={jest.fn()}
      onViewAllMarkets={onViewAllMarkets}
      onChangeSearch={onChangeSearch}
    />,
  );

  expect(screen.getByTestId('assistant-understood')).toBeTruthy();
  expect(screen.getByText('Area: Zayed')).toBeTruthy();
  expect(screen.queryByText(/No units matched/i)).toBeNull();

  await fireEvent.press(screen.getByTestId('assistant-view-all-markets'));
  expect(onViewAllMarkets).toHaveBeenCalledWith('apartments in zayed down payment 1m');

  await fireEvent.press(screen.getByTestId('assistant-change-search'));
  expect(onChangeSearch).toHaveBeenCalledWith('apartments in zayed down payment 1m');
});
