import { parseSearchIntent } from '../src/searchCapabilities';

test.each([
  // Screen, report-screen, unit-code, work-queue, and find-options shortcuts are removed -> search cleanly.
  ['Open Settings', { kind: 'search' }],
  ['Show settings', { kind: 'search' }],
  ['خلي التطبيق عربي', { kind: 'search' }],
  ['افتح الإشعارات', { kind: 'search' }],
  ['Show saved searches', { kind: 'search' }],
  ['Agency dashboard', { kind: 'search' }],
  ['افتح لوحة الشركة', { kind: 'search' }],
  ['Top achiever', { kind: 'search' }],
  ['Team workload', { kind: 'search' }],
  ['Which sources brought in signed deals?', { kind: 'search' }],
  ['Which units are missing photos?', { kind: 'search' }],
  ['وحدات محتاجة مراجعة', { kind: 'search' }],
  ['افتح MIR46', { kind: 'search' }],
  ['مين يناسبه MIR46؟', { kind: 'clarify' }],
  ['Find options for L-0042', { kind: 'search' }],
  ['What fits Sara Hassan?', { kind: 'clarify' }],
  ['Find the offer I sent Sara last week', { kind: 'search' }],
  // Lead lookup by L-code or phone stays available.
  ['L-0042', { kind: 'leads', filters: { lookup: 'l-0042' } }],
  ['01012345678', { kind: 'leads', filters: { lookup: '01012345678' } }],
  // Kept queues, Primary/Resale explicit cues & searches.
  ['Show unassigned leads', { kind: 'leads', filters: { queue: 'unassigned' } }],
  ['مين لسه محدش كلّمهم؟', { kind: 'leads', filters: { queue: 'uncontacted' } }],
  ['Developer apartments in New Cairo', { kind: 'search' }],
  ['Primary apartments in New Cairo', { kind: 'source', source: 'primary' }],
  ['برايمري: شقة في التجمع', { kind: 'source', source: 'primary' }],
  ['Ask: when does Badya deliver?', { kind: 'search' }],
  ['Villa in Rehab', { kind: 'search' }],
  ['Who knows about this?', { kind: 'clarify' }],
  ['Unassigned and overdue follow-ups', { kind: 'clarify' }],
])('routes %s', (query, intent) => {
  expect(parseSearchIntent(query)).toMatchObject(intent);
});
