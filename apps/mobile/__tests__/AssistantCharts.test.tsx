import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { AssistantCard } from '@wehdathub/shared';
import { AssistantCards } from '../src/components/AssistantCards';

const noop = async () => undefined;
const cards: AssistantCard[] = [
  { kind: 'metric_row', items: [{ label: 'Leads', value: 12, delta: 25 }, { label: 'Deals', value: 2, delta: -10 }] },
  { kind: 'bar_breakdown', title: 'Deals by broker', summary: 'Deals by broker: Sara 3', rows: [{ key: 'b1', label: 'Sara', count: 3, avatarUrl: 'https://x/a.png' }, { key: 'b2', label: 'Nour', count: 1 }] },
  { kind: 'trend', title: 'Leads per week', points: [{ label: '01/01', value: 2 }, { label: '01/08', value: 9 }], direction: 'rising', directionLabel: 'Rising', changePct: 80, summary: 'Leads per week: Rising', link: { screen: 'Dashboard', params: {} } },
  { kind: 'share', title: 'Won vs lost', total: 4, parts: [{ key: 'w', label: 'Won', value: 3, pct: 75 }, { key: 'l', label: 'Lost', value: 1, pct: 25 }], summary: 'Won vs lost: Won 75%' },
  { kind: 'price_range', title: 'Prices in X', place: 'X', unit: 'EGP', units: 5, min: 1e6, max: 5e6, median: 2e6, bins: [{ from: 1e6, to: 3e6, count: 3 }, { from: 3e6, to: 5e6, count: 2 }], budget: { value: 4e6, label: 'Client budget 4M' }, summary: 'Prices in X: 1M-5M' },
  { kind: 'compare', title: 'Unit comparison', columns: [{ code: 'A1', title: null }, { code: 'B2', title: null }], rows: [{ key: 'price', label: 'Price', values: ['5,000,000', '4,000,000'], best: 1 }, { key: 'finishing', label: 'Finishing', values: ['full', null], best: null }], summary: 'Unit comparison: A1 / B2' },
  // a kind this app version does not know: falls back to its summary as text
  { kind: 'heatmap', summary: 'Heat summary' } as unknown as AssistantCard,
];

test('renders every chart kind, delta arrows, budget pill, best value, and unknown-kind fallback', async () => {
  const onNavigateLink = jest.fn();
  await render(
    <AssistantCards
      response={{ intent: 'crm_brief', headline: 'h', aiUsed: false, cards }}
      query="q" ar={false}
      onAssignLead={noop} onNudgeLead={noop} onOpenLead={jest.fn()} onOpenUnit={jest.fn()} onPivotPrimary={jest.fn()}
      onNavigateLink={onNavigateLink} onOpenQueue={jest.fn()}
    />,
  );
  for (const id of ['card-metric-row', 'card-bar-breakdown', 'card-trend', 'card-share', 'card-price-range', 'card-compare', 'card-text-answer']) {
    expect(screen.getByTestId(id)).toBeTruthy();
  }
  expect(screen.getByText('▲ 25%')).toBeTruthy();
  expect(screen.getByText('▼ 10%')).toBeTruthy();
  expect(screen.getByText('Client budget 4M')).toBeTruthy();
  expect(screen.getByTestId('compare-best-price')).toBeTruthy();
  expect(screen.getByText('Heat summary')).toBeTruthy();
  expect(screen.getByLabelText('Won vs lost: Won 75%')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Leads per week: Rising'));
  expect(onNavigateLink).toHaveBeenCalledWith('Dashboard', {});
});
