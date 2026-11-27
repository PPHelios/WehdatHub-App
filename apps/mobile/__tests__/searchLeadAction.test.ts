import { readLeadCommand } from '../src/components/SearchLeadAction';

test.each([
  ['Move L-0002 to viewing; note: Saturday agreed', 'Saturday agreed'],
  ['انقل L-0002 إلى معاينة؛ ملاحظة: اتفقنا على السبت', 'اتفقنا على السبت'],
])('keeps the exact target, stage and note in %s', (command, note) => {
  expect(readLeadCommand(command)).toMatchObject({ ref: 'L-0002', stage: 'viewing', note });
});

test('requires an exact target and a reason when closing a lead as lost', () => {
  expect(readLeadCommand('Move L-0002 to lost')).toBe('incomplete');
  expect(readLeadCommand('Change the lead to viewing')).toBe('incomplete');
  expect(readLeadCommand('Change the price filter to 9M')).toBeNull();
  expect(readLeadCommand('Developer inventory in New Cairo')).toBeNull();
});

test.each([
  ['Move Sara to Viewing', { target: 'Sara', stage: 'viewing' }],
  ['Move 01012345678 to Viewing', { target: '01012345678', stage: 'viewing' }],
  ['Add a note to Sara: Saturday agreed', { target: 'Sara', note: 'Saturday agreed' }],
  ['Add a note to Sara that she prefers mornings', { target: 'Sara', note: 'she prefers mornings' }],
  ['انقل ٠١٠١٢٣٤٥٦٧٨ إلى معاينة', { target: '٠١٠١٢٣٤٥٦٧٨', stage: 'viewing' }],
])('keeps the lookup target in %s', (text, result) => {
  expect(readLeadCommand(text)).toMatchObject(result);
});

test('Egyptian spelling preserves the original name and note', () => {
  expect(readLeadCommand('انقل سارة إلى معاينه; ملاحظه: اتفقنا على بكرة')).toEqual({
    target: 'سارة', stage: 'viewing', note: 'اتفقنا على بكرة', lostReason: undefined,
  });
});
