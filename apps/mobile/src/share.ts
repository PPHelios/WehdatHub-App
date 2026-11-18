import { AppState, NativeModules, Platform } from 'react-native';
import type { UploadFile } from '@wehdathub/shared';
import { looksLikeZip } from './whatsappImport';

/** Only a WhatsApp "Export chat" zip is taken from a share: it opens the import screen. */
export interface SharedItems { zip?: UploadFile }
interface RawShare { files?: { uri: string; mimeType?: string | null; name?: string | null }[] }
interface ShareModule { getPending(): Promise<RawShare | null>; clear(): Promise<void> }

const native: ShareModule | undefined = (NativeModules as { ShareIntent?: ShareModule }).ShareIntent;

/** Finds the chat zip in what another app shared. Photos, voice notes, text and other files are ignored (null when no zip). */
export function classifyShare(raw: RawShare | null): SharedItems | null {
  if (!raw) return null;
  let zip: UploadFile | undefined;
  let chatGuess: UploadFile | undefined;
  (raw.files ?? []).forEach((f, i) => {
    const type = (f.mimeType || '').toLowerCase();
    const name = f.name || `shared_${i}`;
    // WhatsApp's "Export chat" with media is a .zip (some phones give no type, so the name counts too).
    if (looksLikeZip({ name: f.name, type })) { if (!zip) zip = { uri: f.uri, name, type: 'application/zip' }; }
    // Safety net: a file named like a WhatsApp export, with no zip name or type, is still taken as the chat zip (never a photo or voice note).
    else if (!chatGuess && !type.startsWith('image/') && !type.startsWith('audio/') && /^WhatsApp Chat/i.test(f.name || '')) chatGuess = { uri: f.uri, name, type: 'application/zip' };
  });
  zip = zip ?? chatGuess;
  return zip ? { zip } : null;
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
