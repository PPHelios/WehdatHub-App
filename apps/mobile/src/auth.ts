import * as Keychain from 'react-native-keychain';
import { create } from 'zustand';
import type { ApiBroker, LoginResult } from '@wehdathub/shared';

const SERVICE = 'wehdathub.session';
type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  token: string | null;
  broker: ApiBroker | null;
  agencyName: string | null;
  restore: () => Promise<void>;
  signIn: (r: LoginResult) => Promise<void>;
  signOut: () => Promise<void>;
}

/** The session token lives in the phone's secure storage (Keychain / Keystore), never in plain storage. */
export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  token: null,
  broker: null,
  agencyName: null,
  async restore() {
    try {
      const saved = await Keychain.getGenericPassword({ service: SERVICE });
      if (saved) {
        const { token, broker, agencyName } = JSON.parse(saved.password);
        if (token && broker) return set({ status: 'signedIn', token, broker, agencyName: agencyName ?? null });
      }
    } catch {
      /* unreadable storage reads as signed out */
    }
    set({ status: 'signedOut', token: null, broker: null, agencyName: null });
  },
  async signIn(r) {
    const agencyName = r.agency.name;
    await Keychain.setGenericPassword('session', JSON.stringify({ token: r.token, broker: r.broker, agencyName }), {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    set({ status: 'signedIn', token: r.token, broker: r.broker, agencyName });
  },
  async signOut() {
    await Keychain.resetGenericPassword({ service: SERVICE }).catch(() => {});
    set({ status: 'signedOut', token: null, broker: null, agencyName: null });
  },
}));

export const currentLang = () => useAuth.getState().broker?.lang ?? 'ar';
