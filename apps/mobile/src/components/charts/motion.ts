import { useEffect } from 'react';
import { ReduceMotion, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

/** A 0 to 1 value that grows once on mount; already 1 when the phone asks for reduced motion. */
export function useGrow(duration = 450) {
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    v.value = reduced ? 1 : withTiming(1, { duration, reduceMotion: ReduceMotion.System });
  }, [duration, reduced, v]);
  return v;
}
