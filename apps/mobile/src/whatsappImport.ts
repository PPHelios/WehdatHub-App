import { ChatMatch } from '@wehdathub/shared';
import type { ChatPost, CodeState, UnitFields, UploadFile } from '@wehdathub/shared';

/** A unit keeps 15 photos; a post offers up to 60 to choose from (same numbers as the add-unit screen and the website). */
export const KEEP = 15;
export const POOL = 60;
/** A zip bigger than this is refused up front (the photos are unpacked into the phone's cache). */
export const MAX_ZIP_BYTES = 1024 * 1024 * 1024;

const IMAGE = /\.(jpe?g|png|webp|heic|heif)$/i;
const CHAT_TEXT = /\.txt$/i;
const base = (p: string) => p.split('/').pop() || p;

export interface ZipEntryLite { path: string; size: number; isDirectory?: boolean }

/** The chat text inside the zip: the biggest-named "chat" .txt, at most 40 MB. */
export function findChatText(entries: ZipEntryLite[]): ZipEntryLite | null {
  const texts = entries.filter((e) => !e.isDirectory && CHAT_TEXT.test(e.path) && e.size <= 40 * 1024 * 1024);
  if (!texts.length) return null;
  return [...texts].sort((a, b) => Number(/chat/i.test(base(b.path))) - Number(/chat/i.test(base(a.path))))[0];
}

/** The zip entries (by their path inside the zip) of the photos the posts use, at most POOL per post, without repeats. Videos are never unpacked. */
export function photoEntriesFor(posts: ChatPost[], entries: ZipEntryLite[]): { paths: string[]; bytes: number; missing: number } {
  const byName = new Map<string, ZipEntryLite>();
  entries.forEach((e) => { if (!e.isDirectory && IMAGE.test(e.path)) byName.set(base(e.path).toLowerCase(), e); });
  const paths = new Set<string>();
  let bytes = 0;
  let missing = 0;
  posts.forEach((p) => p.files.slice(0, POOL).forEach((f) => {
    const hit = byName.get(f.name.toLowerCase());
    if (!hit) { missing += 1; return; }
    if (!paths.has(hit.path)) { paths.add(hit.path); bytes += hit.size; }
  }));
  return { paths: [...paths], bytes, missing };
}

export type PostState = 'idle' | 'working' | 'saved' | 'needs_edit' | 'failed';
export interface ImportPost {
  id: string;
  post: ChatPost;
  /** Every photo of the post (up to 60), the first 15 kept; the person moves, keeps or drops them. */
  photos: UploadFile[];
  picked: boolean;
  state: PostState;
  /** Why the post was not added on its own (what to fix in the edit screen). */
  note?: string;
  /** The post read by the rules (the server's reader, same as the website): the add-unit form's fields. */
  fields?: UnitFields;
  /** The mandatory things the reading could not find (same rules as the add-unit form): the post is not added until they are filled in the edit screen. */
  missing?: string[];
  savedCode?: string;
}

/** Posts ready for the list. `dir` is where the photos were unpacked (a folder path without a trailing slash). Photos not in the zip are dropped. */
export function buildImportPosts(posts: ChatPost[], dir: string, present: Map<string, string>): ImportPost[] {
  return posts.map((post) => {
    const files = post.files.slice(0, POOL).filter((f) => present.has(f.name.toLowerCase()));
    const photos: UploadFile[] = files.map((f, k) => ({ uri: `file://${dir}/${present.get(f.name.toLowerCase())}`, name: f.name, type: 'image/jpeg', ...(k >= KEEP ? { notKept: true } : {}) }));
    return { id: String(post.i), post, photos, picked: true, state: 'idle' as PostState };
  });
}

export const keptOf = (p: ImportPost) => p.photos.filter((x) => !x.notKept);

/** What a post's code says, shown as a badge: a repeat inside the zip, then what the server answered. */
export type CodeBadge =
  | { kind: 'none' }
  | { kind: 'checking' }
  | { kind: 'failed' }
  | { kind: 'dup'; of: number }
  | { kind: 'update'; code: string; photos: number }
  | { kind: 'taken' }
  | { kind: 'new'; code: string };

export function codeBadge(list: ImportPost[], index: number, info: Record<string, CodeState> | null, status: 'checking' | 'done' | 'failed'): CodeBadge {
  const code = list[index]?.post.code;
  if (!code) return { kind: 'none' };
  const first = list.findIndex((p) => p.post.code === code);
  if (first !== index) return { kind: 'dup', of: first + 1 };
  if (status === 'checking') return { kind: 'checking' };
  if (status === 'failed') return { kind: 'failed' };
  const s = info?.[code];
  if (!s) return { kind: 'none' };
  if (s.state === 'update') return { kind: 'update', code: s.code, photos: s.photos };
  if (s.state === 'taken') return { kind: 'taken' };
  return { kind: 'new', code };
}

/** A post whose code is taken by a unit the person may not change, or repeats an earlier post, is never added in bulk. */
export const blockedByCode = (b: CodeBadge) => b.kind === 'taken' || b.kind === 'dup';

/** A post with a mandatory field missing is never added in bulk: it is opened in the edit screen, which marks what is missing. */
export const incomplete = (p: ImportPost) => Boolean(p.missing && p.missing.length);

export interface ImportCounts { total: number; saved: number; remaining: number; ready: number; incomplete: number; blocked: number; photos: number }

/**
 * One set of numbers for the header and the bottom bar. `remaining` (not yet added) always equals ready + incomplete + blocked:
 * ready can be added now, incomplete lacks mandatory fields, blocked is the rest (update, taken, repeated code, not picked, reader failed).
 */
export function importCounts(list: ImportPost[], addable: (p: ImportPost, i: number) => boolean): ImportCounts {
  const c: ImportCounts = { total: list.length, saved: 0, remaining: 0, ready: 0, incomplete: 0, blocked: 0, photos: 0 };
  list.forEach((p, i) => {
    if (p.state === 'saved') { c.saved += 1; return; }
    c.remaining += 1;
    c.photos += p.photos.length;
    if (addable(p, i)) c.ready += 1;
    else if (incomplete(p)) c.incomplete += 1;
    else c.blocked += 1;
  });
  return c;
}

/** One bar for the whole read: listing and the chat 0 to 15%, the photos 15 to 85%, reading the posts 85 to 95%, the codes to 100%. */
export function stagePct(stage: 'list' | 'chat' | 'photos' | 'match' | 'codes', frac = 0): number {
  const f = Math.max(0, Math.min(1, frac));
  switch (stage) {
    case 'list': return Math.round(5 * f);
    case 'chat': return Math.round(5 + 10 * f);
    case 'photos': return Math.round(15 + 70 * f);
    case 'match': return Math.round(85 + 10 * f);
    default: return Math.round(95 + 5 * f);
  }
}

/** Reads the chat text into posts (up to 40), from the date on. */
export function readPosts(text: string, since: string | null) {
  const r = ChatMatch.match(text, { since, windowMin: 10, sameSender: true, pattern: 'auto', codes: null });
  return { posts: r.posts ?? [], stats: r.stats };
}

export const looksLikeZip = (f: { name?: string | null; type?: string | null }) => /\.zip$/i.test(f.name || '') || /zip/i.test(f.type || '');

// ---- Fix many posts at once (like the website's "All rent / All sale" and the one-answer-for-many panel) ----

/** Posts that still need a deal type (sale or rent): the reading could not tell. */
export const lacksDealType = (p: ImportPost) => p.state !== 'saved' && Boolean(p.fields) && !p.fields?.listing_type;
/** Posts that still need an owner phone (a post never says it). */
export const lacksOwnerPhone = (p: ImportPost) => p.state !== 'saved' && Boolean(p.fields) && !p.fields?.owner_phone;

/** The fields of a post with one deal type chosen for it; a rent without a period gets the monthly one (the person can change it in Edit). */
export function withDealType(fields: UnitFields, type: 'sale' | 'rent'): UnitFields {
  const out: UnitFields = { ...fields, listing_type: type };
  if (type === 'rent' && !out.rent_period) out.rent_period = 'monthly';
  return out;
}

/** The fields of a post with the owner's phone filled in; the phone stands in for the name when the post gave none. */
export function withOwnerPhone(fields: UnitFields, phone: string): UnitFields {
  const out: UnitFields = { ...fields, owner_phone: phone };
  if (!out.owner_name) out.owner_name_from_phone = '1';
  return out;
}

/** What the review still lists as missing, as the field names the list shows (owner name is never listed while the phone stands in for it). */
export const missingOf = (blockers: { field: string }[]) => [...new Set(blockers.map((b) => b.field))];
