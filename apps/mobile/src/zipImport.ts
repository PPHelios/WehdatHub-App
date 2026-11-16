import { cancel, isPasswordProtected, listContents, subscribe, unzip } from 'react-native-zip-archive';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { MAX_ZIP_BYTES, findChatText, photoEntriesFor, readPosts, stagePct } from './whatsappImport';
import type { ZipEntryLite } from './whatsappImport';
import type { ChatPost } from '@wehdathub/shared';

export type ZipFailure = 'not_zip' | 'password' | 'too_big' | 'no_space' | 'no_chat' | 'cancelled' | 'failed';
export class ZipImportError extends Error {
  /** `detail`: the native error's words with any path removed (kept for the usage log, never shown). */
  constructor(public reason: ZipFailure, public detail?: string) { super(reason); }
}

export interface Unpacked {
  /** Folder the photos were unpacked into (delete it with `cleanUp` when the import is over). */
  dir: string;
  posts: ChatPost[];
  /** Lower-case file name → path inside `dir`, for the photos that were unpacked. */
  present: Map<string, string>;
  /** Videos and other files in the zip that are never unpacked. */
  skipped: number;
  /** Photos a post names that are not in the zip. */
  missing: number;
  stats: ReturnType<typeof readPosts>['stats'];
}

const plain = (uri: string) => decodeURI(uri.replace(/^file:\/\//, ''));
const isContent = (uri: string) => /^content:\/\//i.test(uri);
/** The native error's words without paths or file names (a path can hold the group's name). */
const scrub = (msg: string) => msg.replace(/(^|\s)(?:\/|[A-Za-z]:\\|content:\/\/|file:\/\/)[^:]*/g, '$1<path>').replace(/\S*[\\/]\S*/g, '<path>').slice(0, 160);

/**
 * Whether an error says the file itself is not a readable zip. Only the zip format's own words count: a message that merely
 * mentions a ".zip" path (a missing file, no permission) is something else, never "not a zip".
 */
export const saysNotZip = (msg: string) => /(not a (valid )?zip|invalid (zip|archive)|bad zip|corrupt|end of central directory|EOCD|signature|unsupported (zip|archive)|zip (file )?(is )?(empty|truncated|corrupt))/i.test(msg) && !/(no such file|does not exist|ENOENT|permission|denied|EACCES|ENOSPC)/i.test(msg);
const base = (p: string) => p.split('/').pop() || p;

/**
 * Reads a WhatsApp export zip on the phone: lists it, unpacks only the chat text, reads the posts, then unpacks only the
 * photos the posts name (videos never). `onPct` gets one number 0 to 95 for the whole read, so the bar never goes back.
 * Throws ZipImportError with the reason (the screen says it in words).
 */
export async function unpackChat(zipUri: string, since: string | null, onPct: (pct: number, stage: 'list' | 'chat' | 'photos' | 'match') => void): Promise<Unpacked> {
  let zip = plain(zipUri);
  // The Android file picker gives a content:// address the zip library cannot open: the file is copied into the app's cache first.
  let copy: string | null = null;
  try {
    if (isContent(zipUri)) {
      copy = `${RNFS.CachesDirectoryPath}/wa-import-${Date.now()}.zip`;
      await RNFS.copyFile(zipUri, copy);
      zip = copy;
    }
    const st = await RNFS.stat(zip);
    if (Number(st.size) > MAX_ZIP_BYTES) throw new ZipImportError('too_big');
    // The photos are a part of the zip; twice the zip's size is more than enough room for what is unpacked.
    const fs = await RNFS.getFSInfo();
    if (fs.freeSpace < Number(st.size) * 1.2) throw new ZipImportError('no_space');
    onPct(stagePct('list', 0), 'list');
    if (await isPasswordProtected(zip)) throw new ZipImportError('password');
    const entries: ZipEntryLite[] = (await listContents(zip)).map((e) => ({ path: e.path, size: e.size, isDirectory: e.isDirectory }));
    const chat = findChatText(entries);
    if (!chat) throw new ZipImportError('no_chat');
    onPct(stagePct('list', 1), 'list');

    const dir = `${RNFS.CachesDirectoryPath}/wa-import/${Date.now()}`;
    await RNFS.mkdir(dir);
    await unzip(zip, dir, { entries: [chat.path] });
    const text = await RNFS.readFile(`${dir}/${chat.path}`, 'utf8');
    onPct(stagePct('chat', 1), 'chat');

    const { posts, stats } = readPosts(text, since);
    onPct(stagePct('match', 0.5), 'match');
    const need = photoEntriesFor(posts, entries);
    if (need.bytes > fs.freeSpace * 0.9) throw new ZipImportError('no_space');
    // Photos only, flat in `dir` (the name in the chat is the file name). The bar follows the unpacked share.
    const sub = subscribe(({ progress }) => onPct(stagePct('photos', progress), 'photos'));
    try {
      if (need.paths.length) await unzip(zip, dir, { entries: need.paths });
    } finally {
      sub.remove();
    }
    const present = new Map<string, string>(need.paths.map((p) => [base(p).toLowerCase(), p]));
    onPct(stagePct('match', 1), 'match');
    const skipped = entries.filter((e) => !e.isDirectory && !/\.(txt|jpe?g|png|webp|heic|heif)$/i.test(e.path)).length;
    return { dir, posts, present, skipped, missing: need.missing, stats };
  } catch (e) {
    if (e instanceof ZipImportError) throw e;
    const msg = String((e as { message?: string })?.message || e);
    const detail = scrub(msg);
    if (/cancel/i.test(msg)) throw new ZipImportError('cancelled', detail);
    if (/password|encrypt/i.test(msg)) throw new ZipImportError('password', detail);
    if (/ENOSPC|no space/i.test(msg)) throw new ZipImportError('no_space', detail);
    if (saysNotZip(msg)) throw new ZipImportError('not_zip', detail);
    throw new ZipImportError('failed', detail);
  } finally {
    if (copy) RNFS.unlink(copy).catch(() => undefined);
  }
}

/** Stops an unpack in progress (the Cancel button). */
export const cancelUnpack = () => cancel().catch(() => undefined);

/** Deletes the unpacked photos (called when the import is over or the screen closes). */
export async function cleanUp(dir: string | null) {
  if (!dir) return;
  try {
    await RNFS.unlink(dir);
  } catch {
    /* already gone */
  }
}
