import { eventText } from '../src/leadEvents';

const ev = (kind: string, extra: object = {}) => ({ id: '1', kind, at: '2026-11-13T18:00:00Z', by: 'Test User', text: null, stage: null, ...extra });

test('history lines read in plain words, never as raw codes', () => {
  expect(eventText(ev('match_sent'), 'ar')).not.toMatch(/match_sent/);
  expect(eventText(ev('follow_up_set'), 'en')).toBe('Set a follow-up');
  expect(eventText(ev('stage', { stage: 'viewing' }), 'en')).toContain('Moved the stage to');
  expect(eventText(ev('note', { text: 'Called back' }), 'en')).toBe('Called back');
  expect(eventText(ev('something_new'), 'en')).toBe('Update');
});
