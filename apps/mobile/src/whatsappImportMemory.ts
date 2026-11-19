import { ChatFingerprint } from '@wehdathub/shared';
import type { ChatDecisionOutcome } from '@wehdathub/shared';
import { api } from './api';
import type { ImportPost } from './whatsappImport';

/**
 * What the agency decided about each post of a chat (saved, discarded, unchanged), kept on the server (shared by every broker, device
 * and the website) so importing the same zip, or a longer export of the same chat, does not ask the same questions: saved posts stay
 * out of the way, discarded ones stay discarded (they can be restored) and unchanged ones start unticked.
 *
 * The screen only uses `load`, `record`, `restore` and `forgetAll`. A small in-memory copy per chat keeps the screen working when the
 * network fails (nothing is thrown; the decisions then live on this phone until the screen closes).
 */
export type Outcome = ChatDecisionOutcome;
export type Memory = Record<string, { o: Outcome; at: number }>;

/** Decisions the server takes in one request. */
export const MAX_PER_REQUEST = 200;

/** The one place a post's id is made (the shared function, byte-identical to the website's). */
export const postFingerprint = (sender: string | null, at: string | number | null, text: string): string => ChatFingerprint.postFingerprint(sender, at, text);
/** The id of a read post: its sender, the chat's own time text and the message as written. */
export const fingerprintOf = (p: { sender: string | null; at: string | null; text: string; orig?: string }) => postFingerprint(p.sender, p.at, p.orig || p.text);

const cache = new Map<string, Memory>();
const pending = new Map<string, Map<string, Outcome>>();
const mem = (fp: string): Memory => { let m = cache.get(fp); if (!m) { m = {}; cache.set(fp, m); } return m; };

/** Forgets what this phone holds (tests, and a new session). */
export function resetMemoryCache() { cache.clear(); pending.clear(); }

const chunks = <T,>(list: T[]): T[][] => Array.from({ length: Math.ceil(list.length / MAX_PER_REQUEST) }, (_, i) => list.slice(i * MAX_PER_REQUEST, (i + 1) * MAX_PER_REQUEST));

/** Sends what could not be sent before, then clears it. Failures keep it for the next call. */
async function flush(fp: string): Promise<void> {
  const p = pending.get(fp);
  if (!p || !p.size) return;
  const items = [...p.entries()].map(([post_fp, outcome]) => ({ post_fp, outcome }));
  for (const part of chunks(items)) {
    try {
      await api.saveChatDecisions(fp, part);
      part.forEach((i) => { if (p.get(i.post_fp) === i.outcome) p.delete(i.post_fp); });
    } catch { return; }
  }
}

/** What is remembered about the chat, and when it was last imported (the server's ISO time). Offline: what this phone holds. */
export async function load(chatFp: string): Promise<{ decisions: Memory; lastImportAt: string | null }> {
  try {
    const r = await api.chatDecisions(chatFp);
    const m: Memory = {};
    Object.entries(r.decisions ?? {}).forEach(([k, v]) => { const at = Date.parse(v.at); m[k] = { o: v.outcome, at: Number.isFinite(at) ? at : 0 }; });
    pending.get(chatFp)?.forEach((o, k) => { m[k] = { o, at: Date.now() }; });
    cache.set(chatFp, m);
    return { decisions: { ...m }, lastImportAt: r.last_import_at ?? null };
  } catch {
    return { decisions: { ...mem(chatFp) }, lastImportAt: null };
  }
}
/** Remembers outcomes for posts of the chat (up to 200 per request; what fails is sent again with the next call). */
export async function record(chatFp: string, items: { pfp: string; outcome: Outcome }[]): Promise<void> {
  const m = mem(chatFp);
  let p = pending.get(chatFp);
  if (!p) { p = new Map(); pending.set(chatFp, p); }
  items.forEach((i) => { m[i.pfp] = { o: i.outcome, at: Date.now() }; p.set(i.pfp, i.outcome); });
  await flush(chatFp);
}
/** Forgets the decisions about these posts (they are asked about again). */
export async function restore(chatFp: string, pfps: string[]): Promise<void> {
  const m = mem(chatFp);
  pfps.forEach((k) => { delete m[k]; pending.get(chatFp)?.delete(k); });
  for (const part of chunks(pfps)) {
    try { await api.forgetChatDecisions(chatFp, part); } catch { return; }
  }
}
/** Forgets everything remembered about this chat. */
export async function forgetAll(chatFp: string): Promise<void> {
  cache.set(chatFp, {});
  pending.delete(chatFp);
  try { await api.forgetChatDecisions(chatFp); } catch { /* the phone's copy is already empty */ }
}

/**
 * Applies what was remembered to a freshly read list. Saved posts leave the list (returned apart as `priorSaved`), discarded
 * ones stay discarded, unchanged ones start unticked. Every post gets its fingerprint (`pfp`).
 */
export function applyMemory(posts: ImportPost[], decisions: Memory): { list: ImportPost[]; priorSaved: ImportPost[] } {
  const list: ImportPost[] = [];
  const priorSaved: ImportPost[] = [];
  posts.forEach((p) => {
    const pfp = fingerprintOf(p.post);
    const o = decisions[pfp]?.o;
    const q = { ...p, pfp };
    if (o === 'saved') priorSaved.push({ ...q, picked: false });
    else if (o === 'discarded') list.push({ ...q, discarded: true, picked: false });
    else if (o === 'unchanged') list.push({ ...q, picked: false });
    else list.push(q);
  });
  return { list, priorSaved };
}

/** What differs between the memory and this list's decisions: outcomes to record, and discards the person restored. */
export function diffDecisions(current: Memory, decisions: { pfp: string; outcome: Outcome | null }[]): { set: { pfp: string; outcome: Outcome }[]; cleared: string[]; mem: Memory } {
  const set: { pfp: string; outcome: Outcome }[] = [];
  const cleared: string[] = [];
  const next: Memory = { ...current };
  const now = Date.now();
  decisions.forEach(({ pfp, outcome }) => {
    const cur = next[pfp];
    if (outcome) {
      if (cur?.o !== outcome) { next[pfp] = { o: outcome, at: now }; set.push({ pfp, outcome }); }
    } else if (cur?.o === 'discarded') { delete next[pfp]; cleared.push(pfp); }
  });
  return { set, cleared, mem: set.length || cleared.length ? next : current };
}

