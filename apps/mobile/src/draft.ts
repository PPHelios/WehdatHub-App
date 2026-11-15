import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UnitFields, UploadFile } from '@wehdathub/shared';

const KEY = 'wehdathub.draft.unit.v1';
export interface UnitDraft { fields: UnitFields; photos: UploadFile[]; describe: string; photoAi: boolean }

/** A half-filled unit survives a closed app or a dead connection. Plain storage is fine: no client phone numbers are kept except the owner's typed number, so it is cleared on save and on sign-out. */
export async function saveDraft(d: UnitDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* a full or unreadable disk must never block typing */
  }
}

export async function loadDraft(): Promise<UnitDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as UnitDraft;
    return d && typeof d === 'object' && d.fields ? { fields: d.fields, photos: Array.isArray(d.photos) ? d.photos : [], describe: d.describe || '', photoAi: Boolean(d.photoAi) } : null;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

export const isEmptyDraft = (d: UnitDraft): boolean => !d.describe.trim() && d.photos.length === 0 && Object.values(d.fields).every((v) => v === undefined || v === '' || v === false || (Array.isArray(v) && !v.length));
