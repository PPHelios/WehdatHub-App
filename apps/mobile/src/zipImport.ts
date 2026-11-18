import { cancel, isPasswordProtected, listContents, subscribe, unzip } from 'react-native-zip-archive';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { ChatMatch } from '@wehdathub/shared';
import { MAX_ZIP_BYTES, photoEntriesFor, stagePct } from './whatsappImport';
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
  stats: ReturnType<typeof ChatMatch.match>['stats'];
}

type Stage = 'list' | 'chat' | 'photos' | 'match';
export interface Signal { cancelled: boolean }
export interface ChatInfo {
  /** Epoch ms of the first and last message (the chat's own clock, read as UTC), or null with no readable message. */
  firstAt: number | null;
  lastAt: number | null;
  total: number;
  /** Messages per day, key YYYY-MM-DD. */
  perDay: Record<string, number>;
  /** A local hash of the chat file's name and its first message header; never the group's name. */
  fingerprint: string;
}
export interface OpenedChat {
  /** The local zip (a cache copy when the picker gave a content:// address). */
  zipPath: string;
  chatText: string;
  info: ChatInfo;
  /** Removes the zip copy (and a shared zip in cache/shared), the chat folder and any read still in progress. Safe to call twice or mid-read. */
  close(): Promise<void>;
}

/** Free space needed, as a multiple of the zip's size: the unpacked chat and photos are a part of the zip. */
const FREE_FACTOR = 1.2;
const CHAT_MAX_BYTES = 40 * 1024 * 1024;
const BIDI = /[‎‏‪-‮⁦-⁩]/g;
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const latin = (s: string) => s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
// A message line: "24/10/2026, 10:15 - Name: text" (Android) or "[24/10/2026, 10:15:32] Name: text" (iPhone). Day first.
const MSG = /^\[?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap]\.?[Mm]\.?|[صم])?\]?\s*(?:-\s+)?[^:]{1,80}?:/;
const HEADLINE = /^\[?\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}:\d{2}/;

const plain = (uri: string) => decodeURI(uri.replace(/^file:\/\//, ''));
const isContent = (uri: string) => /^content:\/\//i.test(uri);
/** The native error's words without paths or file names (a path can hold the group's name). */
const scrub = (msg: string) => msg.replace(/(^|\s)(?:\/|[A-Za-z]:\\|content:\/\/|file:\/\/)[^:]*/g, '$1<path>').replace(/\S*[\\/]\S*/g, '<path>').slice(0, 160);

/**
 * Whether an error says the file itself is not a readable zip. Only the zip format's own words count: a message that merely
 * mentions a ".zip" path (a missing file, no permission) is something else, never "not a zip".
 */
export const saysNotZip = (msg: string) => /(not a (valid )?zip|invalid (zip|archive)|bad zip|corrupt|end of central directory|EOCD|signature|unsupported (zip|archive)|zip (file )?(is )?(empty|truncated|corrupt))/i.test(msg) && !/(no such file|does not exist|ENOENT|permission|denied|EACCES|ENOSPC)/i.test(msg);
const baseName = (p: string) => p.split('/').pop() || p;
const txtOf = (p: string) => /\.txt$/i.test(p);

/**
 * The chat text candidates in the zip, best first: `_chat.txt`, then names that say WhatsApp or chat (English or Arabic),
 * then the biggest .txt. Each is at most 40 MB.
 */
export function chatCandidates(entries: ZipEntryLite[]): ZipEntryLite[] {
  const texts = entries.filter((e) => !e.isDirectory && txtOf(e.path) && e.size <= CHAT_MAX_BYTES);
  const rank = (e: ZipEntryLite) => {
    const n = baseName(e.path);
    if (n.toLowerCase() === '_chat.txt') return 0;
    return /WhatsApp|chat|دردشة|محادثة/i.test(n) ? 1 : 2;
  };
  return [...texts].sort((a, b) => rank(a) - rank(b) || b.size - a.size);
}
export const findChatText = (entries: ZipEntryLite[]): ZipEntryLite | null => chatCandidates(entries)[0] ?? null;

/** Whether the first lines of a text look like chat message headers (a date and a time). */
export function looksLikeChat(text: string): boolean {
  let seen = 0;
  for (const raw of text.replace(BIDI, '').split(/\r?\n/)) {
    const l = latin(raw).trim();
    if (!l) continue;
    if (HEADLINE.test(l)) return true;
    seen += 1;
    if (seen >= 20) break;
  }
  return false;
}

const fnv = (s: string, seed: number) => {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, '0');
};

/** Reads every message header: first and last time, how many, and how many per day. */
export function scanChat(text: string, chatName: string): ChatInfo {
  let firstAt: number | null = null;
  let lastAt: number | null = null;
  let total = 0;
  let firstHeader = '';
  const perDay: Record<string, number> = {};
  for (const raw of text.split(/\r?\n/)) {
    if (raw.length < 8) continue;
    const m = latin(raw.replace(BIDI, '')).trim().match(MSG);
    if (!m) continue;
    const ap = (m[7] || '').toLowerCase().replace(/\./g, '');
    let hour = Number(m[4]);
    if ((ap === 'pm' || ap === 'م') && hour < 12) hour += 12;
    if ((ap === 'am' || ap === 'ص') && hour === 12) hour = 0;
    const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    const at = Date.UTC(year, Number(m[2]) - 1, Number(m[1]), hour, Number(m[5]), Number(m[6] || 0));
    if (!Number.isFinite(at)) continue;
    if (!total) firstHeader = `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}`;
    total += 1;
    if (firstAt === null || at < firstAt) firstAt = at;
    if (lastAt === null || at > lastAt) lastAt = at;
    const day = new Date(at).toISOString().slice(0, 10);
    perDay[day] = (perDay[day] || 0) + 1;
  }
  const key = `${baseName(chatName).toLowerCase()}|${firstHeader}`;
  return { firstAt, lastAt, total, perDay, fingerprint: fnv(key, 0x811c9dc5) + fnv(key, 0x1b873593) };
}

const cancelledErr = () => new ZipImportError('cancelled');
const check = (signal?: Signal) => { if (signal?.cancelled) throw cancelledErr(); };

function mapError(e: unknown): ZipImportError {
  if (e instanceof ZipImportError) return e;
  const msg = String((e as { message?: string })?.message || e);
  const detail = scrub(msg);
  if (/cancel/i.test(msg)) return new ZipImportError('cancelled', detail);
  if (/password|encrypt/i.test(msg)) return new ZipImportError('password', detail);
  if (/ENOSPC|no space/i.test(msg)) return new ZipImportError('no_space', detail);
  if (saysNotZip(msg)) return new ZipImportError('not_zip', detail);
  return new ZipImportError('failed', detail);
}

const rm = (p: string | null) => (p ? RNFS.unlink(p).then(() => undefined, () => undefined) : Promise.resolve());

interface Internal extends OpenedChat {
  _entries: ZipEntryLite[];
  _active: Set<string>;
  _closed: boolean;
}

/**
 * Opens a WhatsApp export zip on the phone once: copies it into the cache if needed (size checked BEFORE the copy), lists it,
 * unpacks only the chat text and reads its message headers. Throws ZipImportError (the screen says the reason in words).
 * `opts.size` is the picker's size for a content:// file, used to refuse a big file before copying it.
 */
export async function openChat(uri: string, opts: { signal?: Signal; size?: number; onPct?: (pct: number, stage: Stage) => void } = {}): Promise<OpenedChat> {
  const { signal, onPct } = opts;
  let zip = plain(uri);
  let copy: string | null = null;
  let chatDir: string | null = null;
  try {
    check(signal);
    const known = Number(opts.size);
    if (Number.isFinite(known) && known > MAX_ZIP_BYTES) throw new ZipImportError('too_big');
    if (isContent(uri)) {
      if (Number.isFinite(known) && known > 0) {
        const room = await RNFS.getFSInfo();
        check(signal);
        if (room.freeSpace < known * FREE_FACTOR) throw new ZipImportError('no_space');
      }
      // The Android file picker gives a content:// address the zip library cannot open: the file is copied into the app's cache first.
      copy = `${RNFS.CachesDirectoryPath}/wa-import-${Date.now()}.zip`;
      await RNFS.copyFile(uri, copy);
      zip = copy;
      check(signal);
    }
    const st = await RNFS.stat(zip);
    check(signal);
    const size = Number(st.size);
    if (size > MAX_ZIP_BYTES) throw new ZipImportError('too_big');
    // The photos are a part of the zip; FREE_FACTOR times the zip's size is more than enough room for what is unpacked.
    const fs = await RNFS.getFSInfo();
    check(signal);
    if (fs.freeSpace < size * FREE_FACTOR) throw new ZipImportError('no_space');
    onPct?.(stagePct('list', 0), 'list');
    const locked = await isPasswordProtected(zip);
    check(signal);
    if (locked) throw new ZipImportError('password');
    const entries: ZipEntryLite[] = (await listContents(zip)).map((e) => ({ path: e.path, size: e.size, isDirectory: e.isDirectory }));
    check(signal);
    const candidates = chatCandidates(entries).slice(0, 3);
    if (!candidates.length) throw new ZipImportError('no_chat');
    onPct?.(stagePct('list', 1), 'list');

    const ownDir = `${RNFS.CachesDirectoryPath}/wa-import/${Date.now()}-chat`;
    chatDir = ownDir;
    await RNFS.mkdir(ownDir);
    check(signal);
    let chatText: string | null = null;
    let chosen: ZipEntryLite | null = null;
    for (const c of candidates) {
      await unzip(zip, ownDir, { entries: [c.path] });
      check(signal);
      const text = await RNFS.readFile(`${ownDir}/${c.path}`, 'utf8');
      check(signal);
      if (looksLikeChat(text)) { chatText = text; chosen = c; break; }
    }
    if (chatText === null || !chosen) throw new ZipImportError('no_chat');
    onPct?.(stagePct('chat', 1), 'chat');
    const info = scanChat(chatText, chosen.path);

    const copyPath = copy;
    // A zip the Share menu put in cache/shared is ours to delete when the import closes; a picker file never is.
    const sharedZip = !copy && zip.startsWith(`${RNFS.CachesDirectoryPath}/shared/`) ? zip : null;
    const opened: Internal = {
      zipPath: zip, chatText, info, _entries: entries, _active: new Set(), _closed: false,
      async close() {
        opened._closed = true;
        const dirs = [...opened._active];
        opened._active.clear();
        await Promise.all([rm(copyPath), rm(sharedZip), rm(ownDir), ...dirs.map(rm)]);
      },
    };
    return opened;
  } catch (e) {
    await Promise.all([rm(copy), rm(chatDir)]);
    throw mapError(e);
  }
}

/**
 * Reads the posts from an opened chat (only those from `since` to `until`) and unpacks only the photos they name (videos never).
 * `onPct` gets one number 0 to 95 for the whole read. A cancel (signal or close) cleans the photo folder and throws 'cancelled'.
 */
export async function readChat(
  opened: OpenedChat,
  opts: { since?: number | string | null; until?: number | string | null; withMedia: boolean; signal?: Signal; onPct?: (pct: number, stage: Stage) => void },
): Promise<Unpacked> {
  const o = opened as Internal;
  const { signal, onPct } = opts;
  const dir = `${RNFS.CachesDirectoryPath}/wa-import/${Date.now()}`;
  let created = false;
  const stop = () => { if (signal?.cancelled || o._closed) throw cancelledErr(); };
  try {
    stop();
    onPct?.(stagePct('chat', 1), 'chat');
    // Same reading as the website; since and until go straight through to the shared parser.
    const r = ChatMatch.match(opened.chatText, { since: opts.since ?? null, until: opts.until ?? null, windowMin: 10, sameSender: true, pattern: 'auto', codes: null } as never);
    const posts = r.posts ?? [];
    const stats = r.stats;
    onPct?.(stagePct('match', 0.5), 'match');
    const entries = o._entries;
    const need = opts.withMedia ? photoEntriesFor(posts, entries) : { paths: [] as string[], bytes: 0, missing: 0 };
    const fs = await RNFS.getFSInfo();
    stop();
    if (need.bytes > fs.freeSpace * 0.9) throw new ZipImportError('no_space');
    await RNFS.mkdir(dir);
    created = true;
    o._active.add(dir);
    stop();
    // Photos only, flat in `dir` (the name in the chat is the file name). The bar follows the unpacked share.
    const sub = subscribe(({ progress }) => onPct?.(stagePct('photos', progress), 'photos'));
    try {
      if (need.paths.length) await unzip(opened.zipPath, dir, { entries: need.paths });
    } finally {
      sub.remove();
    }
    stop();
    const present = new Map<string, string>(need.paths.map((p) => [baseName(p).toLowerCase(), p]));
    onPct?.(stagePct('match', 1), 'match');
    const skipped = entries.filter((e) => !e.isDirectory && !/\.(txt|jpe?g|png|webp|heic|heif)$/i.test(e.path)).length;
    o._active.delete(dir);
    return { dir, posts, present, skipped, missing: need.missing, stats };
  } catch (e) {
    o._active.delete(dir);
    if (created) await rm(dir);
    throw mapError(e);
  }
}

/** The one-call form: open, read, close. The photo folder is left for the caller to `cleanUp`. */
export async function unpackChat(zipUri: string, since: string | null, onPct: (pct: number, stage: Stage) => void): Promise<Unpacked> {
  const opened = await openChat(zipUri, { onPct });
  try {
    return await readChat(opened, { since, withMedia: true, onPct });
  } finally {
    await opened.close();
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

/** Startup sweep: deletes wa-import folders and zip copies in the cache that are older than a day (left by a crash or a kill). */
export async function sweepWaImportCache(now: number = Date.now()): Promise<void> {
  try {
    const items = await RNFS.readDir(RNFS.CachesDirectoryPath);
    await Promise.all(items
      .filter((i) => /^wa-import/.test(i.name) && (i.mtime ? new Date(i.mtime).getTime() : now) < now - 24 * 3600 * 1000)
      .map((i) => rm(i.path)));
  } catch {
    /* nothing to sweep */
  }
}
