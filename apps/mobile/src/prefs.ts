import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { Lang } from '@wehdathub/shared';

export type Appearance = 'system' | 'light' | 'dark';
const KEY = 'wehdathub.prefs';

interface PrefsState {
  appearance: Appearance;
  /** The language of messages, links and flyers made for clients (not the app's own language). */
  clientLang: Lang;
  /** Which More groups the person opened or closed (a group missing here uses its default). */
  navOpen: Record<string, boolean>;
  load: () => Promise<void>;
  setAppearance: (a: Appearance) => void;
  setClientLang: (l: Lang) => void;
  setGroupOpen: (key: string, open: boolean) => void;
}

const save = (s: Pick<PrefsState, 'appearance' | 'clientLang' | 'navOpen'>) => AsyncStorage.setItem(KEY, JSON.stringify({ appearance: s.appearance, clientLang: s.clientLang, navOpen: s.navOpen })).catch(() => undefined);

/** Phone-only choices: Appearance (System unless picked) and the language used for what is sent to clients. */
export const usePrefs = create<PrefsState>((set, get) => ({
  appearance: 'system',
  clientLang: 'ar',
  navOpen: {},
  async load() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const p = raw ? JSON.parse(raw) : null;
      if (p) set({ appearance: p.appearance === 'light' || p.appearance === 'dark' ? p.appearance : 'system', clientLang: p.clientLang === 'en' ? 'en' : 'ar', navOpen: p.navOpen && typeof p.navOpen === 'object' ? Object.fromEntries(Object.entries(p.navOpen).filter(([, v]) => typeof v === 'boolean')) as Record<string, boolean> : {} });
    } catch {
      /* unreadable storage keeps the defaults */
    }
  },
  setAppearance(appearance) { set({ appearance }); save(get()); },
  setClientLang(clientLang) { set({ clientLang }); save(get()); },
  setGroupOpen(key, open) { set({ navOpen: { ...get().navOpen, [key]: open } }); save(get()); },
}));

export const clientLang = (): Lang => usePrefs.getState().clientLang;
/** What a client gets: the language set on that lead first, then the broker's own setting. */
export const leadLang = (lead: { lang?: 'ar' | 'en' | null }): Lang => (lead.lang === 'ar' || lead.lang === 'en' ? lead.lang : clientLang());
