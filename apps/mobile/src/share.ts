import { AppState, NativeModules, Platform } from 'react-native';
import type { UploadFile } from '@wehdathub/shared';

export interface SharedItems { text?: string; photos?: UploadFile[]; voice?: UploadFile }
interface RawShare { text?: string | null; files?: { uri: string; mimeType?: string | null; name?: string | null }[] }
interface ShareModule { getPending(): Promise<RawShare | null>; clear(): Promise<void> }

const native: ShareModule | undefined = (NativeModules as { ShareIntent?: ShareModule }).ShareIntent;

/** Sorts what another app shared (photos, a voice note, text) into what the Add unit screen takes. */
export function classifyShare(raw: RawShare | null): SharedItems | null {
  if (!raw) return null;
  const photos: UploadFile[] = [];
  let voice: UploadFile | undefined;
  (raw.files ?? []).forEach((f, i) => {
    const type = (f.mimeType || '').toLowerCase();
    const name = f.name || `shared_${i}`;
    if (type.startsWith('image/')) photos.push({ uri: f.uri, name, type: type || 'image/jpeg' });
    // WhatsApp voice notes arrive as .opus/.ogg; the server's voice reader accepts ogg, m4a, mp4, mpeg, aac and wav.
    else if (type.startsWith('audio/') && !voice) voice = { uri: f.uri, name, type: type === 'audio/opus' ? 'audio/ogg' : type };
  });
  const text = (raw.text || '').trim();
  if (!photos.length && !voice && !text) return null;
  return { text: text || undefined, photos: photos.length ? photos : undefined, voice };
}

/** Reads what another app shared into this one (Android: Share menu; iPhone: the Share extension) and clears it. */
export async function takeShared(): Promise<SharedItems | null> {
  if (!native) return null;
  try {
    const items = classifyShare(await native.getPending());
    await native.clear();
    return items;
  } catch {
    return null;
  }
}

/** Calls `onShare` when the app opens or returns to the front with something waiting. Returns the unsubscribe. */
export function watchShares(onShare: (s: SharedItems) => void): () => void {
  const check = async () => {
    const s = await takeShared();
    if (s) onShare(s);
  };
  check();
  const sub = AppState.addEventListener('change', (st) => st === 'active' && check());
  return () => sub.remove();
}

export const shareSupported = Boolean(native) && (Platform.OS === 'android' || Platform.OS === 'ios');
