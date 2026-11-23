import { parseSearchIntent } from '../src/searchCapabilities';

test.each([
  ['Show unassigned leads', { kind: 'leads', filters: { queue: 'unassigned' } }],
  ['ممكن عملاء من غير بروكر', { kind: 'leads', filters: { queue: 'unassigned' } }],
  ['مين لسه محدش كلّمهم؟', { kind: 'leads', filters: { queue: 'uncontacted' } }],
  ['مين ميعاد أول رد عدّى؟', { kind: 'leads', filters: { queue: 'late-response' } }],
  ['What viewings do I have tomorrow?', { kind: 'leads', filters: { queue: 'viewings-tomorrow' } }],
  ['معاينات بكرة', { kind: 'leads', filters: { queue: 'viewings-tomorrow' } }],
  ['Who do I need to call today?', { kind: 'leads', filters: { tab: 'due_today' } }],
  ['Show leads with no next step', { kind: 'leads', filters: { tab: 'no_next_step' } }],
  ['Find options for L-0042', { kind: 'leads', filters: { lookup: 'L-0042', matching: true } }],
  ['What fits Sara Hassan?', { kind: 'leads', filters: { lookup: 'Sara Hassan', matching: true } }],
  ['افتح العميل ٠١٠١٢٣٤٥٦٧٨', { kind: 'leads', filters: { lookup: '٠١٠١٢٣٤٥٦٧٨', matching: false } }],
  ['ضيف عميل أحمد ٠١٠١٢٣٤٥٦٧٨', { kind: 'new-lead', name: 'أحمد', phone: '01012345678' }],
  ['Which units are missing photos?', { kind: 'unit-work', missingPhotos: true }],
  ['افتح MIR46', { kind: 'unit', code: 'MIR46' }],
  ['Top achiever', { kind: 'ranking' }],
  ['مين عنده متابعات متأخرة؟', { kind: 'route', destination: 'team' }],
  ['Find the offer I sent Sara last week', { kind: 'links', name: 'Sara', days: 7 }],
  ['افتَح الإعدادات', { kind: 'route', destination: 'settings' }],
  ['خلي التطبيق عربي', { kind: 'route', destination: 'settings' }],
  ['افتح الإشعارات', { kind: 'route', destination: 'notifications' }],
  ['Show saved searches', { kind: 'route', destination: 'savedSearches' }],
  ['مين يناسبه MIR46؟', { kind: 'reverse', code: 'MIR46' }],
  ['Which sources brought in signed deals?', { kind: 'signed-sources' }],
  ['Show settings', { kind: 'route', destination: 'settings' }],
  ['Developer apartments in New Cairo', { kind: 'search' }],
  ['Primary apartments in New Cairo', { kind: 'source', source: 'primary' }],
  ['برايمري: شقة في التجمع', { kind: 'source', source: 'primary' }],
  ['Ask: when does Badya deliver?', { kind: 'search' }],
  ['Resale and primary apartments', { kind: 'source', source: 'both' }],
  ['Villa in Rehab', { kind: 'search' }],
  ['Who knows about this?', { kind: 'clarify' }],
  ['Unassigned and overdue follow-ups', { kind: 'clarify' }],
])('routes %s', (query, intent) => {
  expect(parseSearchIntent(query)).toMatchObject(intent);
});

test('uses context for follow-ups and keeps unspecified lead dates ambiguous', () => {
  expect(parseSearchIntent("Only Sara's", 'leads')).toEqual({ kind: 'assignee', name: 'sara' });
  expect(parseSearchIntent('بس بتوع سارة', 'leads')).toEqual({ kind: 'assignee', name: 'ساره' });
  expect(parseSearchIntent('last month only', 'deals')).toEqual({ kind: 'deals', lastMonth: true });
  expect(parseSearchIntent('Show leads last month', 'leads')).toEqual({ kind: 'clarify' });
  expect(parseSearchIntent('Leads assigned last month', 'leads')).toMatchObject({ kind: 'leads', filters: { assigned: true } });
});

test('filters by the named broker directly from a fresh Search', () => {
  expect(parseSearchIntent('Show leads assigned to Sara Hassan')).toEqual({ kind: 'assignee', name: 'sara hassan' });
  expect(parseSearchIntent('عملاء اللي مع سارة حسن')).toEqual({ kind: 'assignee', name: 'ساره حسن' });
});

test('clarifies assignee and date combinations', () => {
  expect(parseSearchIntent('Show leads assigned to Sara Hassan last month')).toEqual({ kind: 'clarify' });
});

test('preserves names with diacritics and repeated spaces', () => {
  expect(parseSearchIntent('Find options for سَارة   حسن')).toEqual({
    kind: 'leads', filters: { lookup: 'سَارة   حسن', matching: true },
  });
});
