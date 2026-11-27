import { FadeInDown, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';

export const DURATION = { fast: 150, base: 220, slow: 320 } as const;
export const SPRING = { damping: 18, stiffness: 220, mass: 1 } as const;

/** Entering animation; stagger list items with `delayIndex`. Follows the system reduce-motion setting. */
export const enter = (delayIndex = 0) =>
  FadeInDown.duration(DURATION.base).delay(delayIndex * 60).springify().damping(SPRING.damping).stiffness(SPRING.stiffness).mass(SPRING.mass).reduceMotion(ReduceMotion.System);
export const exit = FadeOut.duration(DURATION.fast).reduceMotion(ReduceMotion.System);
export const layout = LinearTransition.duration(DURATION.base).reduceMotion(ReduceMotion.System);
