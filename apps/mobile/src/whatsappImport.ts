import { ChatMatch } from '@wehdathub/shared';
import type { ChatPost, CodeState, UnitFields, UploadFile } from '@wehdathub/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SinceKind } from './usage';
import { DELIVERY_FIELDS, PAYMENT_FIELDS } from './unitRules';

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
/** The stored unit a post's code points to (its edit-form fields and version), read once so the post can be compared to it. */
export interface ExistingUnit { version: number; fields: UnitFields; /** When the stored unit last changed (ms), when the edit endpoint says. */ updatedAt?: number }
/** Why a post that points at a stored unit is not saved as an update: the unit could not be read, the code is another unit's, or the unit changed after the post. */
export type PostBlocker = 'compare_failed' | 'other_unit' | 'older';
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
  /** For a post whose code is an existing unit: that unit (null when it could not be read). */
  existing?: ExistingUnit | null;
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

// ---- Which fields of an existing unit a post really changes (the server's chat plan, services/imports.js: "changed" vs "unchanged") ----

/**
 * The unit's own fields a post can change: price, area, rooms, floor, finishing, place, deal and property type, delivery, payment,
 * owner name and phone. The generated text (the "WhatsApp · sender · date" note, the description, the English summary) is never in
 * this list, so a post that only brings new notes leaves the unit "unchanged", exactly like the website's import.
 */
export const COMPARED_FIELDS = [
  'price_value', 'monthly_rent', 'area_value', 'bua', 'bedrooms', 'bathrooms', 'floor_level', 'floor', 'finishing',
  'compound', 'district', 'listing_type', 'property_type',
  ...DELIVERY_FIELDS.filter((k) => k !== 'is_ready'), 'delivery_month', 'delivery_raw',
  ...PAYMENT_FIELDS,
  'owner_name',
];
/**
 * Never written on an update: the owner phone of a stored unit stays (the post's phone goes nowhere), and the market, readiness,
 * features, notes and generated texts come from the unit (the post's note is appended to the stored notes).
 */
export const NEVER_OVERLAID = ['market', 'is_ready', 'feature', 'notes', 'clean_summary', 'owner_phone', 'code'];
/** A place name the post writes is the unit's own when it equals any of these stored names (the server's "dropEchoes"). */
const PLACE_KEYS = ['compound', 'compound_en', 'compound_ids', 'district', 'city', 'location', 'place_label'];

/** The change groups shown to the person (delivery and payment fields are one line each, like the server's "delivery"). */
export function changeGroup(key: string): string {
  if (DELIVERY_FIELDS.includes(key) || key === 'delivery_month' || key === 'delivery_raw') return 'delivery';
  if (PAYMENT_FIELDS.includes(key)) return 'payment';
  if (key === 'monthly_rent') return 'price_value';
  if (key === 'bua') return 'area_value';
  if (key === 'floor_level') return 'floor';
  return key;
}

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

/** Every place name the stored unit carries (the compound, its English name, ids, district...), folded. */
const storedPlaces = (existing: UnitFields): string[] => PLACE_KEYS.flatMap((k) => {
  const v = existing[k];
  return (Array.isArray(v) ? v : [v]).map((x) => comparable('', x)).filter(Boolean);
});

/** The raw field keys where what the post states differs from the stored unit (a field the post does not state never counts). */
export function changedKeys(existing: UnitFields, post: UnitFields): string[] {
  const out: string[] = [];
  for (const key of COMPARED_FIELDS) {
    const b = comparable(key, post[key]);
    if (!b) continue;
    if (key === 'compound' || key === 'district') {
      if (storedPlaces(existing).includes(b)) continue;
    } else if (comparable(key, existing[key]) === b) continue;
    out.push(key);
  }
  return out;
}

/** The fields (change groups) where what the post states differs from the stored unit. The owner phone is never compared. */
export function changedFields(existing: UnitFields, post: UnitFields): string[] {
  const out: string[] = [];
  for (const key of changedKeys(existing, post)) { const g = changeGroup(key); if (!out.includes(g)) out.push(g); }
  return out;
}

/** The stored unit's fields with only the changed keys taken from the post (raw values); the post's note is appended to the stored notes. */
export function overlayUpdate(existing: UnitFields, post: UnitFields): UnitFields {
  const merged: UnitFields = { ...existing };
  for (const k of changedKeys(existing, post)) if (!NEVER_OVERLAID.includes(k)) merged[k] = post[k];
  const add = typeof post.notes === 'string' ? post.notes.trim() : '';
  const had = typeof existing.notes === 'string' ? existing.notes.trim() : '';
  if (add && !foldArabic(had.toLowerCase()).includes(foldArabic(add.toLowerCase()))) merged.notes = had ? `${had}\n${add}` : add;
  delete merged.code;
  return merged;
}

/** "10/12/2026 5:48" (the chat's own date) as epoch ms, or null. `utc`: the chat's clock read as UTC (like openChat's dates and readChat's since), else the phone's local time. */
export function postTime(p: { at: string | null }, utc = false): number | null {
  const m = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})[,\s]+(\d{1,2}):(\d{2})/.exec(asciiDigits(p.at || ''));
  if (!m) return null;
  const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
  const t = utc ? Date.UTC(y, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5])) : new Date(y, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5])).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Whether the post must not be saved as an update of this stored unit: the stated type, deal or place clearly belong to another unit
 * (the code was reused), or the unit was edited after the post was written.
 */
export function existingBlocker(existing: ExistingUnit, fields: UnitFields, at: number | null): PostBlocker | undefined {
  const differs = (k: string) => { const a = comparable(k, fields[k]); const b = comparable(k, existing.fields[k]); return Boolean(a && b && a !== b); };
  if (differs('property_type') || differs('listing_type')) return 'other_unit';
  const place = comparable('', fields.compound);
  const stored = storedPlaces(existing.fields);
  if (place && stored.length && !stored.some((x) => x === place || x.includes(place) || place.includes(x))) return 'other_unit';
  if (at !== null && existing.updatedAt && existing.updatedAt > at) return 'older';
  return undefined;
}

/** What is still missing for a post: for an existing unit, a field the stored unit already has is not missing (the server fills it from the unit). */
export function missingFor(p: ImportPost): string[] {
  // The owner's name is never required while an owner phone stands in for it.
  const m = (p.missing ?? []).filter((k) => !(k === 'owner_name' && (comparable('owner_phone', p.fields?.owner_phone) || comparable('owner_phone', p.existing?.fields?.owner_phone))));
  const e = p.existing?.fields;
  if (!e) return m;
  return m.filter((k) => !comparable(k, e[k]));
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
export const hasError = (p: ImportPost, badge: CodeBadge) => !p.discarded && p.state !== 'saved' && (incomplete(p) || blockedByCode(badge) || p.state === 'needs_edit' || Boolean(p.blocker) || (badge.kind === 'update' && !p.existing));

export type PostKind = 'new' | 'updated' | 'unchanged' | 'error' | 'discarded' | 'saved';

/** The fields a post changes in the existing unit its code points to (null when it is not an update or the unit could not be read). */
export function changesOf(p: ImportPost, badge: CodeBadge): string[] | null {
  if (badge.kind !== 'update' || !p.existing || !p.fields) return null;
  return changedFields(p.existing.fields, p.fields);
}

/** What the post is for the save: new, updated (a real field differs), unchanged (nothing real differs), or an error. */
export function kindOf(p: ImportPost, badge: CodeBadge): PostKind {
  if (p.state === 'saved') return 'saved';
  if (p.discarded) return 'discarded';
  if (hasError(p, badge) || !p.fields) return 'error';
  if (badge.kind === 'update') return changesOf(p, badge)?.length === 0 ? 'unchanged' : 'updated';
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
export const lacksDealType = (p: ImportPost) => p.state !== 'saved' && !p.discarded && Boolean(p.fields) && !p.fields?.listing_type && !p.existing?.fields?.listing_type;
/** Posts that still need an owner phone (a post never says it). A post for a stored unit never gets one: the unit keeps its own phone. */
export const lacksOwnerPhone = (p: ImportPost) => p.state !== 'saved' && !p.discarded && Boolean(p.fields) && !p.fields?.owner_phone && !p.existing;

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
export type RangeResult = { ok: true; since: string | number | undefined; until: string | number | undefined } | { ok: false; error: 'since' | 'until' | 'order' };

/** The since/until handed to readChat for a choice. A custom range must be a valid date (never silently "all"). */
export function resolveRange(c: RangeChoice, watermark: number | null, now = Date.now()): RangeResult {
  let since: string | number | undefined;
  let until: string | number | undefined;
  if (c.kind === 'last') since = watermark === null ? undefined : watermark + 1;
  else if (c.kind === 'all') since = undefined;
  else if (c.kind === 'custom') {
    const s = parseDateInput(c.sinceText ?? '');
    if (!s) return { ok: false, error: 'since' };
    since = s;
    if ((c.untilText ?? '').trim()) {
      const u = parseDateInput(c.untilText ?? '');
      if (!u) return { ok: false, error: 'until' };
      until = u.includes('T') ? u : `${u}T23:59`;
      if (until < (s.includes('T') ? s : `${s}T00:00`)) return { ok: false, error: 'order' };
    }
  } else since = localDay(now - Number(c.kind) * 86400000);
  return { ok: true, since, until };
}

/** The chat's posts-per-day numbers inside the range (day by day). */
export function countInRange(perDay: Record<string, number>, since?: string | number, until?: string | number): number {
  const day = (v: string | number) => (typeof v === 'number' ? new Date(v).toISOString().slice(0, 10) : v.slice(0, 10));
  const a = since === undefined ? '' : day(since);
  const b = until === undefined ? '9999-12-31' : day(until);
  return Object.entries(perDay).reduce((n, [d, c]) => (d >= a && d <= b ? n + c : n), 0);
}

// ---- What is remembered between imports (per broker and chat) ----

const wmKey = (broker: string, fp: string) => `wa_import_wm:${broker}:${fp}`;
const attKey = (broker: string, fp: string, code: string) => `wa_import_att:${broker}:${fp}:${normCode(code)}`;

export async function loadWatermark(broker: string, fp: string): Promise<number | null> {
  try { const v = Number(await AsyncStorage.getItem(wmKey(broker, fp))); return Number.isFinite(v) && v > 0 ? v : null; } catch { return null; }
}
/** Moves the watermark forward only (to the newest decided post time). */
export async function advanceWatermark(broker: string, fp: string, ms: number): Promise<void> {
  try { const cur = await loadWatermark(broker, fp); if (!cur || ms > cur) await AsyncStorage.setItem(wmKey(broker, fp), String(ms)); } catch { /* remembering is a convenience */ }
}
/** The newest post time among the posts the person has dealt with: saved, discarded, or unchanged. */
export function newestDecided(list: ImportPost[], badges: CodeBadge[]): number | null {
  let best: number | null = null;
  list.forEach((p, i) => {
    const k = kindOf(p, badges[i] ?? { kind: 'none' });
    if (k !== 'saved' && k !== 'discarded' && k !== 'unchanged') return;
    const t = postTime(p.post, true);
    if (t !== null && (best === null || t > best)) best = t;
  });
  return best;
}
export async function loadAttached(broker: string, fp: string, code: string): Promise<string[]> {
  try { const v = JSON.parse((await AsyncStorage.getItem(attKey(broker, fp, code))) || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}
export async function saveAttached(broker: string, fp: string, code: string, names: string[]): Promise<void> {
  try { const cur = await loadAttached(broker, fp, code); await AsyncStorage.setItem(attKey(broker, fp, code), JSON.stringify([...new Set([...cur, ...names])])); } catch { /* a convenience */ }
}

/** The photos an update may still add: a unit keeps 15 in all. */
export const updatePhotoRoom = (existingPhotos: number) => Math.max(0, KEEP - Math.max(0, existingPhotos || 0));

/** The edit endpoint's answer as the stored unit a post is compared with (its last change time when it says it). */
export function toExisting(e: { version: number; fields: UnitFields; updated_at?: string | number | null }): ExistingUnit {
  const t = e.updated_at === undefined || e.updated_at === null ? NaN : typeof e.updated_at === 'number' ? e.updated_at : Date.parse(e.updated_at);
  return { version: e.version, fields: e.fields, ...(Number.isFinite(t) ? { updatedAt: t } : {}) };
}
