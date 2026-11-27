import { onMessage } from '@react-native-firebase/messaging';
import { screenFor, startFirebase, startPush } from '../src/push';

jest.mock('../src/api', () => ({ api: { registerDevice: jest.fn().mockResolvedValue(undefined), removeDevice: jest.fn() } }));

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

test('a foreground alert delivers its message and target without opening the screen', async () => {
  const open = jest.fn();
  const received = jest.fn();
  const stop = await startPush(open, received);
  const [, onForeground] = jest.mocked(onMessage).mock.calls[0];
  await onForeground({
    notification: { title: 'New lead', body: 'Assigned to you' },
    data: { url: '/app/leads/L-0042' },
  });

  expect(received).toHaveBeenCalledWith('New lead: Assigned to you', { name: 'Lead', params: { ref: 'L-0042' } });
  expect(open).not.toHaveBeenCalled();
  stop();
});
