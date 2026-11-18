import { withRetries } from '../src/retry';

const noWait = () => Promise.resolve();

test('a step that fails once or twice is tried again and its answer is returned', async () => {
  let n = 0;
  const step = jest.fn(async () => { n += 1; if (n < 3) throw new Error('upload_network'); return 'ok'; });
  await expect(withRetries(step, { tries: 3, wait: noWait })).resolves.toBe('ok');
  expect(step).toHaveBeenCalledTimes(3);
});

test('after the last try the last error is thrown', async () => {
  const step = jest.fn(async () => { throw new Error('upload_timeout'); });
  await expect(withRetries(step, { tries: 3, wait: noWait })).rejects.toThrow('upload_timeout');
  expect(step).toHaveBeenCalledTimes(3);
});

test('a step that works is run once, and the wait doubles between tries', async () => {
  const ok = jest.fn(async () => 1);
  await withRetries(ok, { wait: noWait });
  expect(ok).toHaveBeenCalledTimes(1);
  const waits: number[] = [];
  let n = 0;
  await withRetries(async () => { n += 1; if (n < 3) throw new Error('x'); }, { tries: 3, delayMs: 100, wait: async (ms) => { waits.push(ms); } });
  expect(waits).toEqual([100, 200]);
});
