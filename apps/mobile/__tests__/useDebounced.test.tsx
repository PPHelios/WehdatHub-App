import { act, renderHook } from '@testing-library/react-native';
import { useDebounced } from '../src/useDebounced';

jest.useFakeTimers();

test('the value updates only after typing pauses', () => {
  const { result, rerender } = renderHook(({ v }: { v: string }) => useDebounced(v, 300), { initialProps: { v: 'a' } });
  rerender({ v: 'ab' });
  rerender({ v: 'abc' });
  expect(result.current).toBe('a');
  act(() => {
    jest.advanceTimersByTime(300);
  });
  expect(result.current).toBe('abc');
});
