import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

interface CoachState {
  /** The mark on screen now, if any. */
  active: string | null;
  /** One tip per app session: set when a mark is shown, so the next screen stays quiet. */
  shown: boolean;
  /** Asks to show a mark. It shows only if no tip was shown this session and this broker has not seen it before. */
  request: (id: string, brokerId?: string) => Promise<void>;
  dismiss: () => void;
}

export const coachKey = (id: string, brokerId: string) => `wehdathub.coach:${id}:${brokerId}`;

export const useCoachMarks = create<CoachState>((set, get) => ({
  active: null,
  shown: false,
  async request(id, brokerId) {
    if (!brokerId || get().shown) return;
    try {
      if (await AsyncStorage.getItem(coachKey(id, brokerId))) return;
      if (get().shown) return; // another mark won while storage was read
      set({ shown: true, active: id });
      await AsyncStorage.setItem(coachKey(id, brokerId), '1');
    } catch {
      // Storage unreadable: skip rather than show it on every visit.
    }
  },
  dismiss: () => set({ active: null }),
}));
