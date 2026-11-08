import { act, renderHook } from '@testing-library/react-native';
import { useDebounced } from '../src/useDebounced';

jest.useFakeTimers();

test('the value updates only after typing pauses', async () => {
  const { result, rerender } = await renderHook(({ v }: { v: string }) => useDebounced(v, 300), { initialProps: { v: 'a' } });
  await rerender({ v: 'ab' });
  await rerender({ v: 'abc' });
  expect(result.current).toBe('a');
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  expect(result.current).toBe('abc');
});
