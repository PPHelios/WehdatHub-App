import type { AssistantQueryResponse } from '@wehdathub/shared';
import { isGenericHeadline, leadLine, phraseFor, variantOf } from '../src/assistant/phrasing';

const base = { headline: "", cards: [] as AssistantQueryResponse["cards"], aiUsed: false };
const units = (total: number) => ({ status: 'results', source: 'parser', total, items: [] }) as AssistantQueryResponse['units'];
const cases: Record<string, AssistantQueryResponse> = {
  unit_many: { ...base, intent: 'unit_search', units: units(42) },
  unit_few: { ...base, intent: 'unit_search', units: units(3) },
  unit_none: { ...base, intent: 'unit_search', units: units(0) },
  leads: { ...base, intent: 'crm_leads', windowLabel: 'Live queue', cards: [{ kind: 'stuck_leads', queue: 'q', total: 7, recommendedBrokers: [], canAssign: false, canNudge: false, items: [] }] },
  deals: { ...base, intent: 'crm_deals', windowLabel: 'This month', understood: { appliedFilters: [], brokerRole: 'closer' } },
  team: { ...base, intent: 'crm_team' },
  primary: { ...base, intent: 'primary_answer' },
  clarify: { ...base, intent: 'clarify' },
  other: { ...base, intent: 'crm_brief' },
};

test.each(['ar', 'en'] as const)('lead line per intent (%s)', (lang) => {
  const lines = Object.fromEntries(Object.entries(cases).map(([k, r]) => [k, leadLine('turn-1', lang, r)]));
  expect(lines).toMatchSnapshot();
});

test('the opener varies with the turn id but is stable for one id', () => {
  const r = cases.unit_many;
  expect(phraseFor('same', 'en', r)).toBe(phraseFor('same', 'en', r));
  const seen = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => phraseFor(id, 'en', r)));
  expect(seen.size).toBeGreaterThan(1);
  expect(variantOf('x', 3)).toBeLessThan(3);
});

test('a real server headline is kept; a missing or generic one is replaced', () => {
  expect(leadLine('t', 'en', { ...cases.unit_many, headline: '12 villas in Mivida' })).toBe('12 villas in Mivida');
  expect(isGenericHeadline('Results')).toBe(true);
  expect(isGenericHeadline('  ')).toBe(true);
  expect(isGenericHeadline('3 leads waiting')).toBe(false);
  expect(leadLine('t', 'ar', { ...cases.unit_many, headline: 'نتايج' })).toMatch(/42/);
});

test('unit_search count lead is only used for results/none statuses', () => {
  const ask = { ...base, intent: 'unit_search', units: { status: 'ask', source: 'parser', total: 4, items: [] } } as AssistantQueryResponse;
  expect(phraseFor('t', 'en', ask)).not.toMatch(/units|No units/);
  expect(phraseFor('t', 'en', cases.unit_few)).toMatch(/3/);
});
