import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { suggestPlaces, type ListPlace, type PlaceList, type PlaceMatch } from '@wehdathub/shared';
import { api } from './api';

const KEY = 'wehdathub.places.v1';
const PENDING_KEY = 'wehdathub.places.pending.v1';
const CHECK_EVERY_MS = 60 * 60 * 1000;

interface State {
  list: PlaceList | null;
  /** Compounds this broker just added, shown at once until the owner approves them (the next version brings the approved row). */
  pending: ListPlace[];
  checkedAt: number;
}
export const usePlaces = create<State>(() => ({ list: null, pending: [], checkedAt: 0 }));

async function read<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Keeps the approved place list on the phone. Loads the saved copy, then asks the server only whether the version changed
 * (on open and at most once an hour); the whole list is downloaded again only when it did. A failure keeps the saved copy.
 */
export async function syncPlaces(force = false): Promise<void> {
  const s = usePlaces.getState();
  if (!s.list) {
    const saved = await read<PlaceList>(KEY);
    const pending = await read<ListPlace[]>(PENDING_KEY);
    if (saved || pending) usePlaces.setState({ list: saved, pending: pending ?? [] });
  }
  const now = Date.now();
  const cur = usePlaces.getState();
  if (!force && cur.list && now - cur.checkedAt < CHECK_EVERY_MS) return;
  try {
    const r = await api.placeList(cur.list?.version);
    usePlaces.setState({ checkedAt: now });
    if ('unchanged' in r) return;
    // An approved place replaces the local pending copy of the same name.
    const names = new Set(r.places.flatMap((p) => [p.name_en, p.name_ar]).filter(Boolean).map((n) => String(n).toLowerCase()));
    const pending = usePlaces.getState().pending.filter((p) => !names.has(String(p.name_en || p.name_ar).toLowerCase()));
    usePlaces.setState({ list: r, pending });
    await AsyncStorage.setItem(KEY, JSON.stringify(r)).catch(() => undefined);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending)).catch(() => undefined);
  } catch {
    /* offline or a server error: the saved list keeps working */
  }
}

/** A compound the broker typed that is not on the list yet: shown from now on, on this phone only. */
export async function addPendingPlace(name: string): Promise<void> {
  const n = name.trim();
  if (n.length < 2) return;
  const pending = usePlaces.getState().pending;
  if (pending.some((p) => (p.name_en || p.name_ar) === n)) return;
  const row: ListPlace = { id: `pending:${n}`, name_en: n, name_ar: null, aliases: [], area_id: null, subzone_id: null, lat: null, lng: null };
  usePlaces.setState({ pending: [...pending, row] });
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...pending, row])).catch(() => undefined);
}

/** Matches typing on the phone with the server's rules. Null while no list has been downloaded yet (the caller asks the server). */
export function matchPlaces(text: string, limit = 8): PlaceMatch[] | null {
  const { list, pending } = usePlaces.getState();
  if (!list) return null;
  return suggestPlaces(text, { places: [...list.places, ...pending], areas: list.areas }, limit);
}

/** Cleared on sign-out. */
export async function clearPlaces(): Promise<void> {
  usePlaces.setState({ list: null, pending: [], checkedAt: 0 });
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
  await AsyncStorage.removeItem(PENDING_KEY).catch(() => undefined);
}
