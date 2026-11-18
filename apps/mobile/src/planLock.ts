import { create } from 'zustand';
import type { PlanLockedError } from '@wehdathub/shared';

/** The last call the plan guard refused (402). The pay / ask-your-manager sheet reads it; closing the sheet clears it. */
export const usePlanLock = create<{ error: PlanLockedError | null; show: (e: PlanLockedError) => void; clear: () => void }>((set) => ({
  error: null,
  show: (error) => set({ error }),
  clear: () => set({ error: null }),
}));
