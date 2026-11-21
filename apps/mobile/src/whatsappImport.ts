import { ChatMatch, ChatParse } from '@wehdathub/shared';
import type { ChatPlanChange, ChatPlanInput, ChatPlanPost, ChatPost, CodeState, UnitFields, UploadFile } from '@wehdathub/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SinceKind } from './usage';

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
/** Why a post is not saved as an update, or at all (from the server's plan): the plan could not be read, the code is another unit's, the unit changed after the post, or the planner refused it. */
export type PostBlocker = 'compare_failed' | 'other_unit' | 'older' | 'invalid' | 'forbidden';
export interface ImportPost {
  id: string;
  post: ChatPost;
  /** Every photo of the post (up to 60), the first 15 kept; the person moves, keeps or drops them. */
  photos: UploadFile[];
  picked: boolean;
  /** Thrown out of this import by the person (never touches a saved unit): it vanishes from the list and counts, and can be restored. */
  discarded?: boolean;
  state: PostState;
  /** Why the post was not added on its own (what to fix in the edit screen). */
  note?: string;
  /** The post read by the rules (the server's reader, same as the website): the add-unit form's fields. */
  fields?: UnitFields;
  /** The mandatory things the reading could not find (same rules as the add-unit form): the post is not added until they are filled in the edit screen. */
  missing?: string[];
  /** What the server's chat planner says this post does (null when it could not be asked). */
  plan?: ChatPlanPost | null;
  /** Why this post must not be saved as an update of the stored unit (never ticked). */
  blocker?: PostBlocker;
  /** One key per post, kept until it is saved, so a retry (or a double tap) never makes a second unit. */
  saveKey?: string;
  savedCode?: string;
  /** Stable id of the post (sender, time, wording) used to remember what was decided about it across imports. */
  pfp?: string;
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

/** A code as one comparable text: HP-12, hp 12 and HP12 are the same code. */
export const normCode = (c: string | null | undefined) => String(c ?? '').toUpperCase().replace(/[\s\-_./]+/g, '');

/**
 * `list` is every post; a discarded or saved post never counts as the other copy of a code. When several live posts write the same code
 * the newest one (the last in the chat) stands, the earlier ones are marked as repeats of it.
 */
export function codeBadge(list: ImportPost[], index: number, info: Record<string, CodeState> | null, status: 'checking' | 'done' | 'failed'): CodeBadge {
  const me = list[index];
  const code = me?.post.code;
  if (!code) return { kind: 'none' };
  const live = (p: ImportPost) => !p.discarded && p.state !== 'saved';
  if (live(me)) {
    const n = normCode(code);
    let newest = index;
    list.forEach((p, k) => { if (k > newest && live(p) && normCode(p.post.code) === n) newest = k; });
    if (newest !== index) return { kind: 'dup', of: newest + 1 };
  }
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

const asciiDigits = (t: string) => t.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
/** Arabic spelling variants are one letter for the comparison: أإآ to ا, ة to ه, ى to ي (marks and the tatweel are dropped). */
export const foldArabic = (t: string) => t.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\u064B-\u065F\u0640]/g, '');
/** Fields where "false" or an empty list just means "not stated". */
const FLAG_KEYS = ['is_ready', 'feature'];

/** A value as one comparable text: numbers as numbers ("8,000,000" = "8000000"), phones as 01xxxxxxxxx, the rest trimmed, folded and lower-cased. */
export function comparable(key: string, v: unknown): string {
  if (v === false && FLAG_KEYS.includes(key)) return '';
  if (Array.isArray(v) && !v.length) return '';
  const raw = Array.isArray(v) ? v.join(',') : typeof v === 'boolean' ? (v ? '1' : '0') : v === undefined || v === null ? '' : String(v);
  const t = foldArabic(asciiDigits(raw)).replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return '';
  if (key === 'owner_phone') {
    const d = t.replace(/\D/g, '').replace(/^0020/, '').replace(/^20(?=1\d{9}$)/, '');
    return d && !d.startsWith('0') ? `0${d}` : d;
  }
  const n = t.replace(/[,\s]/g, '');
  return /^-?\d+(\.\d+)?$/.test(n) ? String(Number(n)) : t;
}

/** "10/12/2026 5:48" (the chat's own date) as epoch ms, or null. `utc`: the chat's clock read as UTC (like openChat's dates and readChat's since), else the phone's local time. */
export function postTime(p: { at: string | null }, utc = false): number | null {
  const m = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})[,\s]+(\d{1,2}):(\d{2})/.exec(asciiDigits(p.at || ''));
  if (!m) return null;
  const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
  const t = utc ? Date.UTC(y, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5])) : new Date(y, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5])).getTime();
  return Number.isFinite(t) ? t : null;
}

/** What is still missing for a post: for an existing unit the server fills it from the unit, so nothing is missing. */
export function missingFor(p: ImportPost): string[] {
  if (p.plan?.existing) return [];
  // The owner's name is never required while an owner phone stands in for it.
  return (p.missing ?? []).filter((k) => !(k === 'owner_name' && comparable('owner_phone', p.fields?.owner_phone)));
}

const PHONE_IN_TEXT = /(?<!\d)(?:\+?20)?0?1[0125]\d{8}(?!\d)/g;

/** The phones a text writes, as 01xxxxxxxxx: spaces and dashes between digits are removed line by line (never across lines). */
export function phonesInText(text: string): string[] {
  const out: string[] = [];
  asciiDigits(String(text || '')).split(/\r?\n/).forEach((line) => {
    const squeezed = line.replace(/(?<=\d)[ \-]+(?=\d)/g, '');
    for (const m of squeezed.matchAll(PHONE_IN_TEXT)) out.push(comparable('owner_phone', m[0]));
  });
  return out;
}

/** The owner phone is only what the post's own text says: never the sender's chat phone, a default or a stale value. */
export function withTextPhoneOnly(fields: UnitFields, text: string): UnitFields {
  const have = comparable('owner_phone', fields.owner_phone);
  if (!have || phonesInText(text).includes(have)) return fields;
  const { owner_phone: _p, ...rest } = fields; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
}

/** A phone with no name: the phone stands in as the owner's name, so the post is never sent back for a missing name. */
export function withImpliedOwner(fields: UnitFields): UnitFields {
  if (comparable('owner_phone', fields.owner_phone) && !String(fields.owner_name ?? '').trim()) return { ...fields, owner_name_from_phone: '1' };
  return fields;
}

/** A post with a mandatory field missing is never added in bulk: it is opened in the edit screen, which marks what is missing. */
export const incomplete = (p: ImportPost) => missingFor(p).length > 0;

/** A post that cannot be saved as it is: incomplete, code of a unit the person can't change, repeated code, or the form rejected it. Errors never block the others: they are skipped and counted. */
/** (An update whose stored unit could not be read is an error too: it is never saved blind.) */
export const hasError = (p: ImportPost, badge: CodeBadge) => !p.discarded && p.state !== 'saved' && (incomplete(p) || blockedByCode(badge) || p.state === 'needs_edit' || Boolean(p.blocker) || (badge.kind === 'update' && !p.plan));

export type PostKind = 'new' | 'updated' | 'unchanged' | 'error' | 'discarded' | 'saved';

/** The changes a post makes in the existing unit its code points to, as the server's plan lists them (null when it is not an update). */
export function changesOf(p: ImportPost, badge: CodeBadge): ChatPlanChange[] | null {
  // A post that names another unit: what differs from the stored one, so the warning card can say it.
  if (p.plan?.kind === 'other_unit') return p.plan.changes?.length ? p.plan.changes : null;
  if (badge.kind !== 'update' || !p.plan || p.plan.kind !== 'update') return null;
  return p.plan.changes;
}

/** What the post is for the save: new, updated (a real field differs), unchanged (nothing real differs), or an error. */
export function kindOf(p: ImportPost, badge: CodeBadge): PostKind {
  if (p.state === 'saved') return 'saved';
  if (p.discarded) return 'discarded';
  if (hasError(p, badge) || !p.fields) return 'error';
  if (p.plan?.kind === 'unchanged') return 'unchanged';
  if (p.plan?.kind === 'update') return 'updated';
  return 'new';
}

/** Saved by "Save all": ticked, and a valid new or changed unit (errors, unchanged and discarded units are skipped even when ticked). */
export function savable(p: ImportPost, badge: CodeBadge): boolean {
  const k = kindOf(p, badge);
  return p.picked && p.state !== 'working' && (k === 'new' || k === 'updated');
}

/** The posts with the ticks a person starts with: only valid new or changed units are ticked. */
export const withDefaultTicks = (list: ImportPost[], badges: CodeBadge[]): ImportPost[] => list.map((p, i) => {
  const k = kindOf(p, badges[i] ?? { kind: 'none' });
  return p.state === 'saved' ? p : { ...p, picked: k === 'new' || k === 'updated' };
});

export interface ImportCounts {
  total: number; saved: number; discarded: number; errors: number; unchanged: number; unticked: number;
  newCount: number; updated: number;
  /** Ticked valid units: what "Save all" saves. */
  willSave: number;
  /** Everything left out: errors + unchanged + discarded + unticked valid units. */
  skipped: number;
  /** Posts still in the list (not saved, not discarded). */
  remaining: number; photos: number;
}

/** One set of numbers for the header, the summary line and the Save button. */
export function importCounts(list: ImportPost[], badges: CodeBadge[]): ImportCounts {
  const c: ImportCounts = { total: list.length, saved: 0, discarded: 0, errors: 0, unchanged: 0, unticked: 0, newCount: 0, updated: 0, willSave: 0, skipped: 0, remaining: 0, photos: 0 };
  list.forEach((p, i) => {
    const k = kindOf(p, badges[i] ?? { kind: 'none' });
    if (k === 'saved') { c.saved += 1; return; }
    if (k === 'discarded') { c.discarded += 1; return; }
    c.remaining += 1;
    c.photos += p.photos.length;
    if (k === 'error') c.errors += 1;
    else if (k === 'unchanged') c.unchanged += 1;
    else if (p.picked) { c.willSave += 1; if (k === 'new') c.newCount += 1; else c.updated += 1; }
    else c.unticked += 1;
  });
  c.skipped = c.errors + c.unchanged + c.discarded + c.unticked;
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
export const lacksDealType = (p: ImportPost) => p.state !== 'saved' && !p.discarded && Boolean(p.fields) && !p.fields?.listing_type && !p.plan?.existing;
/** Posts that still need an owner phone (a post never says it). A post for a stored unit never gets one: the unit keeps its own phone. */
export const lacksOwnerPhone = (p: ImportPost) => p.state !== 'saved' && !p.discarded && Boolean(p.fields) && !p.fields?.owner_phone && !p.plan?.existing;

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

// ---- The range step: which part of the chat to read ----

export type { SinceKind };
/** What openChat tells about the whole chat (the zip stays open for the range step). */
export interface ChatInfo { firstAt: number | null; lastAt: number | null; total: number; perDay: Record<string, number>; fingerprint: string }

const pad = (n: number) => String(n).padStart(2, '0');
export const localDay = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/**
 * A typed date as 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm', or null when it is not a real date. Arabic-Indic digits are fine, and so are
 * D/M/YYYY and "2026-10-24 18:30". Empty or invalid is never "all": the caller shows an error.
 */
export function parseDateInput(text: string): string | null {
  const t = asciiDigits(String(text ?? '')).trim();
  let parts: string[] | null = null;
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2}))?$/.exec(t);
  if (iso) parts = [iso[1], iso[2], iso[3], iso[4], iso[5]];
  else {
    const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[T\s]+(\d{1,2}):(\d{2}))?$/.exec(t);
    if (dmy) parts = [dmy[3], dmy[2], dmy[1], dmy[4], dmy[5]];
  }
  if (!parts) return null;
  const [y, mo, d] = [Number(parts[0]), Number(parts[1]), Number(parts[2])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  let out = `${y}-${pad(mo)}-${pad(d)}`;
  if (parts[3] !== undefined) {
    const [h, mi] = [Number(parts[3]), Number(parts[4])];
    if (h > 23 || mi > 59) return null;
    out += `T${pad(h)}:${pad(mi)}`;
  }
  return out;
}

export interface RangeChoice { kind: SinceKind; sinceText?: string; untilText?: string }
export type RangeResult = { ok: true; since: string | undefined; until: string | undefined } | { ok: false; error: 'since' | 'until' | 'order' };

/**
 * The since/until handed to readChat for a choice (the dates come from the shared ChatParse.rangeBounds, the same as the website).
 * A custom range must be a valid date (never silently "all"); its until day counts whole. `lastImportAt` is the server's ISO time.
 */
export function resolveRange(c: RangeChoice, lastImportAt: string | null, now = new Date()): RangeResult {
  let since: string | null = null;
  let until: string | null = null;
  if (c.kind === 'custom') {
    const sd = parseDateInput(c.sinceText ?? '');
    if (!sd) return { ok: false, error: 'since' };
    let ud: string | null = null;
    if ((c.untilText ?? '').trim()) {
      ud = parseDateInput(c.untilText ?? '');
      if (!ud) return { ok: false, error: 'until' };
      if (ud.slice(0, 10) < sd.slice(0, 10)) return { ok: false, error: 'order' };
    }
    ({ since, until } = ChatParse.rangeBounds('custom', { now, since: sd, until: ud ? ud.slice(0, 10) : null }));
  } else ({ since, until } = ChatParse.rangeBounds(c.kind === 'last' && !lastImportAt ? '30' : c.kind, { now, lastImportAt }));
  return { ok: true, since: since ?? undefined, until: until ?? undefined };
}

/** The chat's posts-per-day numbers inside the range (day by day); until is exclusive, like the readers'. */
export function countInRange(perDay: Record<string, number>, since?: string, until?: string): number {
  const a = since === undefined ? '' : since.slice(0, 10);
  const b = until === undefined ? '9999-12-31' : until.slice(0, 10);
  return Object.entries(perDay).reduce((n, [d, c]) => (d >= a && d < b ? n + c : n), 0);
}

// ---- What is remembered between imports (per broker and chat) ----

const attKey = (broker: string, fp: string, code: string) => `wa_import_att:${broker}:${fp}:${normCode(code)}`;

export async function loadAttached(broker: string, fp: string, code: string): Promise<string[]> {
  try { const v = JSON.parse((await AsyncStorage.getItem(attKey(broker, fp, code))) || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}
export async function saveAttached(broker: string, fp: string, code: string, names: string[]): Promise<void> {
  try { const cur = await loadAttached(broker, fp, code); await AsyncStorage.setItem(attKey(broker, fp, code), JSON.stringify([...new Set([...cur, ...names])])); } catch { /* a convenience */ }
}

/** The photos an update may still add: a unit keeps 15 in all. */
export const updatePhotoRoom = (existingPhotos: number) => Math.max(0, KEEP - Math.max(0, existingPhotos || 0));

// ---- The server's chat plan (POST /units/chat-plan): what each post does to the agency's units ----

/** Posts per plan request (the server drops the rest). */
export const PLAN_CHUNK = 60;

const planInput = (p: ImportPost): ChatPlanInput => {
  const t = postTime(p.post);
  return { id: p.id, fields: p.fields ?? {}, text: p.post.orig || p.post.text, ...(t === null ? {} : { at: new Date(t).toISOString() }) };
};

/** Asks the server for every post's plan, 60 at a time. A post whose chunk failed (or that the server skipped) gets null. */
export async function planPosts(send: (posts: ChatPlanInput[]) => Promise<{ posts: ChatPlanPost[] }>, list: ImportPost[]): Promise<(ChatPlanPost | null)[]> {
  const out: (ChatPlanPost | null)[] = list.map(() => null);
  for (let i = 0; i < list.length; i += PLAN_CHUNK) {
    try {
      const r = await send(list.slice(i, i + PLAN_CHUNK).map(planInput));
      const byId = new Map((r.posts ?? []).map((a) => [String(a.id), a]));
      list.slice(i, i + PLAN_CHUNK).forEach((p, k) => { out[i + k] = byId.get(p.id) ?? null; });
    } catch { /* those posts stay unplanned: an update among them is an error ("could not compare") */ }
  }
  return out;
}

/** The post with the server's answer on it: other unit, older, invalid and forbidden answers are errors (never ticked). */
export function withPlan(p: ImportPost, a: ChatPlanPost | null): ImportPost {
  const blocker: PostBlocker | undefined = !a ? undefined : a.kind === 'other_unit' ? 'other_unit' : a.kind === 'older' ? 'older' : a.kind === 'invalid' ? 'invalid' : a.kind === 'forbidden' ? 'forbidden' : undefined;
  return { ...p, plan: a, blocker };
}

/** The stored unit's form fields with the plan's patch on top and the post's note appended to the stored notes. */
export function applyPlanPatch(stored: UnitFields, plan: ChatPlanPost): UnitFields {
  const merged: UnitFields = { ...stored, ...plan.patch };
  const add = (plan.notes_append ?? '').trim();
  const had = typeof stored.notes === 'string' ? stored.notes.trim() : '';
  if (add && !foldArabic(had.toLowerCase()).includes(foldArabic(add.toLowerCase()))) merged.notes = had ? `${had}\n${add}` : add;
  delete merged.code;
  return merged;
}
