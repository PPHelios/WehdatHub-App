import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './auth';
import { foldArabic, postTime } from './whatsappImport';
import type { ImportPost } from './whatsappImport';

/**
 * What the person decided about each post of a chat, per chat (the chat fingerprint), so importing the same zip (or a longer
 * export of the same chat) again does not ask the same questions: saved posts stay out of the way, discarded ones stay
 * discarded (they can be restored) and unchanged ones start unticked.
 *
 * The screen only uses `load`, `record`, `restore` and `forgetAll` and `postFingerprint`: today they sit on AsyncStorage
 * (per broker), and can be swapped for the server's chat-decisions endpoints without touching the screen.
 */
export type Outcome = 'saved' | 'discarded' | 'unchanged';
export type Memory = Record<string, { o: Outcome; at: number }>;

/** Entries kept per chat; the oldest decisions are dropped first. */
export const MEMORY_CAP = 2000;

const memKey = (broker: string, fp: string) => `wa_import_mem:${broker}:${fp}`;
const INDEX_KEY = 'wa_import_mem_index';
const OUTCOMES: Outcome[] = ['saved', 'discarded', 'unchanged'];

// Two 32-bit FNV-1a passes with different seeds: small, deterministic, no dependency.
function fnv(text: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

const normText = (t: string) => foldArabic(String(t ?? '')).toLowerCase().replace(/[‎‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();

/** The one place a post's id is made: the same sender, time (ms) and wording give the same id on every import. */
export function postFingerprint(sender: string | null, atMs: number | null, text: string): string {
  const s = `${normText(sender ?? '')}|${atMs ?? ''}|${normText(text)}`;
  return fnv(s, 2166136261).toString(36) + fnv(s, 0x9747b28c).toString(36);
}
/** The id of a read post. */
export const fingerprintOf = (p: { sender: string | null; at: string | null; text: string; orig?: string }) => postFingerprint(p.sender, postTime(p), p.orig || p.text);

/** Keeps the newest `cap` entries. */
export function capMemory(mem: Memory, cap = MEMORY_CAP): Memory {
  const keys = Object.keys(mem);
  if (keys.length <= cap) return mem;
  const keep = keys.sort((a, b) => mem[b].at - mem[a].at).slice(0, cap);
  return Object.fromEntries(keep.map((k) => [k, mem[k]]));
}

const brokerId = () => String(useAuth.getState().broker?.id ?? 'me');
interface Stored { m: Memory; last: number }

async function indexed(key: string): Promise<void> {
  try {
    const cur = JSON.parse((await AsyncStorage.getItem(INDEX_KEY)) || '[]') as string[];
    if (!cur.includes(key)) await AsyncStorage.setItem(INDEX_KEY, JSON.stringify([...cur, key]));
  } catch { /* a convenience */ }
}
async function read(fp: string): Promise<Stored> {
  try {
    const raw = JSON.parse((await AsyncStorage.getItem(memKey(brokerId(), fp))) || '{}') as { m?: Record<string, { o?: unknown; at?: unknown }>; last?: unknown };
    const m: Memory = {};
    Object.entries(raw.m ?? {}).forEach(([k, v]) => { if (v && OUTCOMES.includes(v.o as Outcome) && typeof v.at === 'number') m[k] = { o: v.o as Outcome, at: v.at }; });
    return { m, last: typeof raw.last === 'number' ? raw.last : 0 };
  } catch { return { m: {}, last: 0 }; }
}
async function write(fp: string, st: Stored): Promise<void> {
  try {
    const key = memKey(brokerId(), fp);
    await AsyncStorage.setItem(key, JSON.stringify({ m: capMemory(st.m), last: st.last }));
    await indexed(key);
  } catch { /* remembering is a convenience */ }
}

/** What is remembered about the chat, and when it was last imported. */
export async function load(chatFp: string): Promise<{ decisions: Memory; lastImportAt: number | null }> {
  const st = await read(chatFp);
  return { decisions: st.m, lastImportAt: st.last || null };
}
/** Remembers outcomes for posts of the chat. */
export async function record(chatFp: string, items: { pfp: string; outcome: Outcome }[], now = Date.now()): Promise<void> {
  const st = await read(chatFp);
  items.forEach((i) => { st.m[i.pfp] = { o: i.outcome, at: now }; });
  await write(chatFp, { m: st.m, last: now });
}
/** Forgets the decisions about these posts (they are asked about again). */
export async function restore(chatFp: string, pfps: string[]): Promise<void> {
  const st = await read(chatFp);
  pfps.forEach((k) => { delete st.m[k]; });
  await write(chatFp, st);
}
/** Forgets everything remembered about this chat. */
export async function forgetAll(chatFp: string): Promise<void> {
  try { await AsyncStorage.removeItem(memKey(brokerId(), chatFp)); } catch { /* a convenience */ }
}

/** Removes every remembered decision of every chat (on logout). */
export async function wipeAllMemory(): Promise<void> {
  try {
    const keys = JSON.parse((await AsyncStorage.getItem(INDEX_KEY)) || '[]') as string[];
    await Promise.all(keys.map((k) => AsyncStorage.removeItem(k)));
    await AsyncStorage.removeItem(INDEX_KEY);
  } catch { /* a convenience */ }
}

// Signing out wipes what was remembered on this phone.
let wasIn = useAuth.getState().status === 'signedIn';
useAuth.subscribe((s) => {
  const inNow = s.status === 'signedIn';
  if (wasIn && !inNow) void wipeAllMemory();
  wasIn = inNow;
});

/**
 * Applies what was remembered to a freshly read list. Saved posts leave the list (returned apart as `priorSaved`), discarded
 * ones stay discarded, unchanged ones start unticked. Every post gets its fingerprint (`pfp`).
 */
export function applyMemory(posts: ImportPost[], mem: Memory): { list: ImportPost[]; priorSaved: ImportPost[] } {
  const list: ImportPost[] = [];
  const priorSaved: ImportPost[] = [];
  posts.forEach((p) => {
    const pfp = fingerprintOf(p.post);
    const o = mem[pfp]?.o;
    const q = { ...p, pfp };
    if (o === 'saved') priorSaved.push({ ...q, picked: false });
    else if (o === 'discarded') list.push({ ...q, discarded: true, picked: false });
    else if (o === 'unchanged') list.push({ ...q, picked: false });
    else list.push(q);
  });
  return { list, priorSaved };
}

/** What differs between the memory and this list's decisions: outcomes to record, and discards the person restored. */
export function diffDecisions(mem: Memory, decisions: { pfp: string; outcome: Outcome | null }[]): { set: { pfp: string; outcome: Outcome }[]; cleared: string[]; mem: Memory } {
  const set: { pfp: string; outcome: Outcome }[] = [];
  const cleared: string[] = [];
  const next: Memory = { ...mem };
  const now = Date.now();
  decisions.forEach(({ pfp, outcome }) => {
    const cur = next[pfp];
    if (outcome) {
      if (cur?.o !== outcome) { next[pfp] = { o: outcome, at: now }; set.push({ pfp, outcome }); }
    } else if (cur?.o === 'discarded') { delete next[pfp]; cleared.push(pfp); }
  });
  return { set, cleared, mem: set.length || cleared.length ? capMemory(next) : mem };
}
