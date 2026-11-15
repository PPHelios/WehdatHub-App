import { Platform, Vibration } from 'react-native';

/** A short tick after a save or a tap that worked. */
export function tick() {
  try {
    Vibration.vibrate(Platform.OS === 'ios' ? 10 : 15);
  } catch {
    // No vibration motor: nothing to do.
  }
}
