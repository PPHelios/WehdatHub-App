import { screenFor, startFirebase } from '../src/push';

jest.mock('../src/api', () => ({ api: { registerDevice: jest.fn(), removeDevice: jest.fn() } }));

test('an alert opens the lead or the unit it names, and nothing else', () => {
  expect(screenFor('/app/leads/L-0042')).toEqual({ name: 'Lead', params: { ref: 'L-0042' } });
  expect(screenFor('/app/units/NH-V12')).toEqual({ name: 'Unit', params: { code: 'NH-V12' } });
  expect(screenFor('/app/notifications')).toBeNull();
  expect(screenFor(undefined)).toBeNull();
});

test('Firebase stays off when the server has no identifiers', async () => {
  expect(await startFirebase(null)).toBe(false);
  expect(await startFirebase(undefined)).toBe(false);
  const one = { apiKey: 'k', appId: 'a', projectId: 'p', messagingSenderId: 's' };
  expect(await startFirebase({ android: one, ios: one })).toBe(true);
});
