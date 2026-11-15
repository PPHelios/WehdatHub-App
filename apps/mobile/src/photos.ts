import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import type { Asset, ImagePickerResponse } from 'react-native-image-picker';
import type { UploadFile } from '@wehdathub/shared';

export const MAX_PHOTOS = 15;
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
