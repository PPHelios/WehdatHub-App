// Place matching for the phone. A line-for-line copy of the server's rules (domain/areas.js, domain/mapPlaces.js,
// domain/placeNames.js, domain/searchText.js). tests/fixtures/place-suggest.json is checked on both sides, so they cannot drift.
import type { PlaceSuggestion } from './api';

export interface ListPlace { id: string; name_en: string | null; name_ar: string | null; aliases?: string[] | null; area_id: string | null; subzone_id: string | null; lat: number | null; lng: number | null }
export interface ListArea { id: string; parent_id: string | null; name_en: string | null; name_ar: string | null; aliases?: string[] | null; lat: number | null; lng: number | null }
export type PlaceMatch = PlaceSuggestion & { lat?: number | null; lng?: number | null };

export function normalizeSearch(text: unknown): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[^0-9a-zء-ي٠-٩ٱ-ۓ-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameKey(name: unknown): string {
  return normalizeSearch(String(name || '')).replace(/[^a-z0-9ء-ي ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
const NOISE = new Set(["compound", "resort", "كمبوند", "كومباوند"]);
export function placeKey(name: unknown): string {
  return nameKey(name).split(' ').filter((w) => w && !NOISE.has(w)).join(' ');
}
function keysOf(p: { name_en?: string | null; name_ar?: string | null; aliases?: string[] | null }): string[] {
  const out = new Set<string>();
  for (const n of [p.name_en, p.name_ar, ...(p.aliases || [])]) {
    const k = placeKey(n);
    if (k.length >= 2) out.add(k);
  }
  return [...out];
}
const bigrams = (k: string): Map<string, number> => {
  const s = ` ${k} `;
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) out.set(s.slice(i, i + 2), (out.get(s.slice(i, i + 2)) || 0) + 1);
  return out;
};
function dice(a: string, b: string): number {
  const x = bigrams(a);
  const y = bigrams(b);
  let hit = 0;
  for (const [g, n] of x) hit += Math.min(n, y.get(g) || 0);
  return (2 * hit) / (Math.max(1, a.length + 1) + Math.max(1, b.length + 1));
}
function chain(areas: ListArea[], id: string): ListArea[] {
  const byId = new Map(areas.map((a) => [a.id, a]));
  const out: ListArea[] = [];
  const seen = new Set<string>();
  for (let cur = byId.get(id); cur && !seen.has(cur.id); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined) {
    seen.add(cur.id);
    out.unshift(cur);
  }
  return out;
}
function placement(areas: ListArea[], id: string): { area_id: string | null; subzone_id: string | null } {
  const path = chain(areas, id);
  if (!path.length) return { area_id: null, subzone_id: null };
  return { area_id: path[0].id, subzone_id: path.length > 1 ? path[path.length - 1].id : null };
}
const KIND_RANK = { compound: 0, subzone: 1, area: 2 } as const;

/** Up to `limit` suggestions for the typed text: exact names and aliases, then starts-with, then contains, then spelling-alike. */
export function suggestPlaces(text: string, { places, areas }: { places: ListPlace[]; areas: ListArea[] }, limit = 8): PlaceMatch[] {
  const q = placeKey(text);
  if (q.length < 2) return [];
  const byId = new Map(areas.map((a) => [a.id, a]));
  const pathOf = (row: ListPlace | ListArea): string => {
    const own = 'parent_id' in row ? chain(areas, row.id).slice(0, -1) : [row.area_id, row.subzone_id].filter((i): i is string => !!i).map((i) => byId.get(i)).filter((a): a is ListArea => !!a);
    return own.map((a) => a.name_en || a.name_ar).join(' › ');
  };
  const rows: { kind: 'compound' | 'area' | 'subzone'; row: ListPlace | ListArea }[] = [
    ...places.map((p) => ({ kind: 'compound' as const, row: p })),
    ...areas.map((a) => ({ kind: (a.parent_id ? 'subzone' : 'area') as 'area' | 'subzone', row: a })),
  ];
  const out: (PlaceMatch & { score: number })[] = [];
  for (const { kind, row } of rows) {
    let best: { score: number; via: 'name' | 'alias' | 'alike' } | null = null;
    const names = [placeKey(row.name_en), placeKey(row.name_ar)].filter(Boolean);
    for (const k of keysOf(row)) {
      const isName = names.includes(k);
      let score = 0;
      if (k === q) score = 4;
      else if (k.startsWith(q) || k.split(' ').some((w) => w.startsWith(q))) score = 3;
      else if (k.includes(q)) score = 2;
      else if (q.length >= 4 && dice(q, k) >= 0.55) score = 1 + dice(q, k) / 10;
      if (score && (!best || score > best.score)) best = { score, via: score < 2 ? 'alike' : isName ? 'name' : 'alias' };
    }
    if (best) {
      const at = kind === 'compound' ? { area_id: (row as ListPlace).area_id || null, subzone_id: (row as ListPlace).subzone_id || null } : placement(areas, row.id);
      out.push({ kind, id: row.id, name_en: row.name_en || null, name_ar: row.name_ar || null, path: pathOf(row), via: best.via, ...at, lat: row.lat ?? null, lng: row.lng ?? null, score: best.score });
    }
  }
  return out
    .sort((a, b) => b.score - a.score || KIND_RANK[a.kind] - KIND_RANK[b.kind] || String(a.name_en || a.name_ar).localeCompare(String(b.name_en || b.name_ar)))
    .slice(0, limit)
    .map(({ score: _score, ...rest }) => rest);
}
