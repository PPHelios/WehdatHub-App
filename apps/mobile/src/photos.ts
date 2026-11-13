import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import type { Asset, ImagePickerResponse } from 'react-native-image-picker';
import type { UploadFile } from '@wehdathub/shared';

export const MAX_PHOTOS = 15; // kept per unit
export const MAX_POOL = 60; // picked per unit; only the kept ones are uploaded, and only when Save is pressed
// Phones shrink the photo before upload (about 1.6 MB instead of 6+): saves mobile data and time. The server resizes again.
const OPTIONS = { mediaType: 'photo' as const, maxWidth: 1600, maxHeight: 1600, quality: 0.8 as const };

const toFiles = (r: ImagePickerResponse): UploadFile[] =>
  (r.assets ?? [])
    .filter((a: Asset) => Boolean(a.uri))
    .map((a: Asset, i: number) => ({ uri: a.uri as string, name: a.fileName || `photo_${Date.now()}_${i}.jpg`, type: a.type || 'image/jpeg' }));

export async function pickPhotos(room: number): Promise<UploadFile[]> {
  if (room <= 0) return [];
  return toFiles(await launchImageLibrary({ ...OPTIONS, selectionLimit: room }));
}

export async function takePhoto(): Promise<UploadFile[]> {
  return toFiles(await launchCamera({ ...OPTIONS, saveToPhotos: false }));
}

/** New photos join the list (up to 60). Those beyond the 15 kept start as "not kept": the broker chooses which to keep. */
export function addPicked(prev: UploadFile[], got: UploadFile[]): UploadFile[] {
  let kept = prev.filter((x) => !x.notKept).length;
  const next = got.map((g) => {
    if (kept < MAX_PHOTOS) { kept += 1; return g; }
    return { ...g, notKept: true };
  });
  return [...prev, ...next].slice(0, MAX_POOL);
}

/** Keep or drop one picked photo. Keeping is refused (the list is returned as it was) while 15 are kept. */
export function toggleKeep(prev: UploadFile[], uri: string): UploadFile[] {
  const it = prev.find((x) => x.uri === uri);
  if (!it) return prev;
  if (!it.notKept) return prev.map((x) => (x.uri === uri ? { ...x, notKept: true } : x));
  if (prev.filter((x) => !x.notKept).length >= MAX_PHOTOS) return prev;
  return prev.map((x) => (x.uri === uri ? { ...x, notKept: false } : x));
}
