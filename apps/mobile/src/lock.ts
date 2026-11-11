import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { create } from 'zustand';

const FLAG = 'wehdathub.lock.enabled';
const SERVICE = 'wehdathub.lock';
/** The app locks after this long in the background. */
export const LOCK_AFTER_MS = 30_000;

interface LockState {
  enabled: boolean;
  locked: boolean;
  load: () => Promise<void>;
  enable: () => Promise<boolean>;
  disable: () => Promise<void>;
  lock: () => void;
  unlock: (prompt: string) => Promise<boolean>;
}

/**
 * App lock: a small secret in the Keychain/Keystore that can only be read after the phone's fingerprint, face or screen
 * lock. Reading it is the unlock. The session token itself stays where it is; the lock only hides the screens.
 */
export const useLock = create<LockState>((set) => ({
  enabled: false,
  locked: false,
  async load() {
    try {
      const on = (await AsyncStorage.getItem(FLAG)) === '1';
      set({ enabled: on, locked: on });
    } catch {
      set({ enabled: false, locked: false });
    }
  },
  async enable() {
    // Some phones refuse the biometric-or-passcode rule; fall back to the screen lock alone before giving up.
    const rules = [Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE, Keychain.ACCESS_CONTROL.DEVICE_PASSCODE];
    for (const accessControl of rules) {
      try {
        await Keychain.setGenericPassword('lock', '1', { service: SERVICE, accessControl, accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY });
        await AsyncStorage.setItem(FLAG, '1');
        set({ enabled: true, locked: false });
        return true;
      } catch {
        /* try the next rule */
      }
    }
    return false;
  },
  async disable() {
    await Keychain.resetGenericPassword({ service: SERVICE }).catch(() => {});
    await AsyncStorage.removeItem(FLAG).catch(() => {});
    set({ enabled: false, locked: false });
  },
  lock: () => set((s) => (s.enabled ? { locked: true } : s)),
  async unlock(prompt) {
    try {
      const got = await Keychain.getGenericPassword({ service: SERVICE, authenticationPrompt: { title: prompt } });
      if (got) {
        set({ locked: false });
        return true;
      }
    } catch {
      /* cancelled or failed: stay locked */
    }
    return false;
  },
}));
