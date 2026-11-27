import { logEvent } from '@react-native-firebase/analytics';
import { startAnalytics, track } from '../src/analytics';

test('analytics reports whether an event was accepted so usage can fall back to the server', async () => {
  expect(await track('feature_used')).toBe(false);
  await startAnalytics();

  const event = { feature: 'call_tap', ok: 1 };
  expect(await track('feature_used', event)).toBe(true);
  expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'feature_used', { ...event, surface: 'app' });

  jest.mocked(logEvent).mockImplementationOnce(() => { throw new Error('Analytics unavailable'); });
  expect(await track('feature_used', event)).toBe(false);
});
