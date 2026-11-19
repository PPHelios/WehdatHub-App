import { trigger } from 'react-native-haptic-feedback';
import type { HapticFeedbackTypes } from 'react-native-haptic-feedback';

// Follow the phone's own settings: vibrate when there is no haptic engine, stay silent when the person turned vibration off.
const options = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

function fire(type: `${HapticFeedbackTypes}`) {
  try {
    trigger(type, options);
  } catch {
    // No haptic motor: nothing to do.
  }
}

/** A light tap after a save or a tap that worked. */
export const tick = () => fire('impactLight');
/** Recording started. */
export const recordStart = () => fire('impactLight');
/** The finger crossed the cancel line (called on each crossing, both ways). */
export const crossCancel = () => fire('selection');
/** The recording locked (hands free). */
export const locked = () => fire('impactMedium');
/** A note was thrown away. */
export const discarded = () => fire('notificationWarning');
/** A note was sent. */
export const sent = () => fire('notificationSuccess');
/** Too short, microphone refused, or recording failed. */
export const failed = () => fire('notificationError');
