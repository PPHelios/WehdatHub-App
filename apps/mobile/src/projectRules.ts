import type { BoxPlace, CatalogueBoxItem, Lang, ProjectCard, ProjectRead, UnitFields } from '@wehdathub/shared';
import { plain } from './readback';

// The rules of the project screens that need no screen: the card's facts, page numbers, the add/edit project form's fields, what a read
// message fills, what is required and what is posted. The website's equivalents: web/views/catalogueList.js and web/static/projectForm.js.

export const STATUSES = ['launching', 'selling', 'sold_out'] as const;
export const STATUS_TEXT: Record<string, { ar: string; en: string }> = {
  launching: { ar: 'إطلاق جديد', en: 'New launch' },
  selling: { ar: 'متاح', en: 'Selling' },
  sold_out: { ar: 'اتباع', en: 'Sold out' },
};
export const PROJECT_TYPES = ['apartment', 'duplex', 'penthouse', 'studio', 'villa', 'townhouse', 'twin_villa', 'chalet', 'office', 'clinic', 'shop', 'commercial'] as const;
export const BEDROOM_CHOICES = [1, 2, 3, 4, 5, 6] as const;
export const MAX_PROJECT_PHOTOS = 10;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const L = (lang: Lang, ar: string, en: string) => (lang === 'en' ? en : ar);

/** 2,000,000 as "2M EGP" / "2 مليون ج.م", 750,000 as "750K EGP" (the website's card). */
export function moneyShort(n: unknown, lang: Lang): string | null {
  const v = Number(n);
  if (!(v > 0)) return null;
  const m = v / 1e6;
  const s = m >= 1 ? `${Number(m.toFixed(m >= 10 ? 1 : 2))}${L(lang, ' مليون', 'M')}` : `${Math.round(v / 1000)}${L(lang, ' ألف', 'K')}`;
  return `${s} ${L(lang, 'ج.م', 'EGP')}`;
}

export const projectName = (p: Pick<ProjectCard, 'name' | 'name_en'>, lang: Lang) => (lang === 'en' ? p.name_en || p.name : p.name);
export const developerOf = (p: ProjectCard, lang: Lang) => p.developer ?? (lang === 'en' ? p.developer_name_en || p.developer_name : p.developer_name || p.developer_name_en) ?? null;
/** The place with its governorate: what the card shows under the name. */
export function placeOf(p: ProjectCard): string {
  if (p.place) return [p.place, p.governorate].filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
  return [p.district, p.city, p.governorate].filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
}
export function deliveryOf(p: ProjectCard): string | null {
  if (p.delivery) return p.delivery;
  if (p.delivery_year) return `${p.delivery_quarter ? `Q${p.delivery_quarter} ` : ''}${p.delivery_year}`;
  return p.delivery_raw || null;
}

/** The fact pills of a card: from price, bedrooms, feddan, down payment, years. A card that carries readable facts shows those. */
export function factPills(p: ProjectCard, lang: Lang): string[] {
  if (p.facts?.length) return p.facts.map((f) => `${f.label} ${f.value}`.trim());
  const b = p.bedroom_options ?? [];
  const from = moneyShort(p.price_from, lang);
  return [
    from ? `${L(lang, 'من', 'From')} ${from}` : null,
    b.length ? `${b.length > 1 ? `${Math.min(...b)}–${Math.max(...b)}` : b[0]} ${L(lang, 'غرف', 'bed')}` : null,
    Number(p.area_acres) > 0 ? `${Number(p.area_acres)} ${L(lang, 'فدان', 'feddan')}` : null,
    Number(p.down_pct_min) > 0 ? `${L(lang, 'مقدم', 'Down')} ${Number(p.down_pct_min)}%` : null,
    Number(p.years_max) > 0 ? `${Number(p.years_max)} ${L(lang, 'سنين', 'yrs')}` : null,
  ].filter((x): x is string => Boolean(x));
}

/** Page numbers to show: the first, the last and the current ±2, with null where pages are skipped. Previous/next are buttons of their own. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 1) return [];
  const keep = new Set<number>([1, pages]);
  for (let i = page - 2; i <= page + 2; i++) if (i >= 1 && i <= pages) keep.add(i);
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    // A gap of one page shows that page; a longer gap shows an ellipsis.
    if (i && n - sorted[i - 1] === 2) out.push(n - 1);
    else if (i && n - sorted[i - 1] > 2) out.push(null);
    out.push(n);
  });
  return out;
}

/** A number typed in a filter box (Arabic digits, commas) as a number, or undefined when empty or not a number. */
export function numberOf(text: string): number | undefined {
  const s = plain(text).replace(/[,،٬\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined;
  const n = Number(s);
  return n > 0 ? n : undefined;
}

// ---- The catalogue search box ----

export interface CatalogueSearch { q: string; place: { id: string; label: string } | null; features: { key: string; label: string }[]; developer: { id: string; label: string } | null; bed?: number; max?: string }
export const EMPTY_SEARCH: CatalogueSearch = { q: '', place: null, features: [], developer: null };
export const isFiltered = (s: CatalogueSearch) => Boolean(s.q || s.place || s.features.length || s.developer || s.bed || s.max);

/** The suggestions under the catalogue box: places (areas and sub-areas, never compounds), then features, developers and projects. The shown items are held locally. */
export function boxGroups(items: CatalogueBoxItem[]) {
  return {
    places: items.filter((i): i is BoxPlace => i.kind === 'area' || i.kind === 'subzone'),
    features: items.filter((i): i is Extract<CatalogueBoxItem, { kind: 'feature' }> => i.kind === 'feature'),
    developers: items.filter((i): i is Extract<CatalogueBoxItem, { kind: 'developer' }> => i.kind === 'developer'),
    projects: items.filter((i): i is Extract<CatalogueBoxItem, { kind: 'project' }> => i.kind === 'project'),
  };
}
// ---- The add / edit project form ----

/** The form's values. Keys are the fields the website posts, plus a few that only the screen shows (place_label, place_path, developer_label). */
export type ProjectFields = UnitFields;
export const UI_ONLY = ['place_label', 'place_path', 'developer_label', 'place_governorate'];
const list = (v: ProjectFields[string]): string[] => (Array.isArray(v) ? v : []);
const text = (v: ProjectFields[string]): string => (typeof v === 'string' ? v : '');

export const hasPlace = (f: ProjectFields) => Boolean(text(f.area_id) || text(f.subzone_id));
export const stepsOf = (lang: Lang) => [L(lang, 'المشروع والمكان', 'Project and place'), L(lang, 'الأرقام والأسعار', 'Numbers and prices'), L(lang, 'المطور والصور', 'Developer and photos')];

/** What is required: the project name and the area. Every other field is optional. */
export function projectBlockers(f: ProjectFields, lang: Lang, editing = false): { field: string; label: string; step: 1 | 2 | 3 }[] {
  const out: { field: string; label: string; step: 1 | 2 | 3 }[] = [];
  if (!text(f.name).trim()) out.push({ field: 'name', label: L(lang, 'اسم المشروع', 'Project name'), step: 1 });
  // A saved project always has a place (shown from its district); an edit that does not touch it sends none.
  if (!hasPlace(f) && !(editing && text(f.place_label))) out.push({ field: 'place', label: L(lang, 'المنطقة', 'Area'), step: 1 });
  return out;
}

/** The parents of a picked place and its governorate (the top area), shown under the box and never edited. */
export function placeContext(p: BoxPlace): { parents: string; governorate: string } {
  const parts = (p.path || '').split(/\s*[›·]\s*/).filter(Boolean);
  const own = p.label || p.name_ar || p.name_en || '';
  return { parents: parts.join(' › '), governorate: parts[0] || own };
}

/** The fields a picked area or sub-area writes. Never a compound; a new request is cleared. */
export function areaPatch(p: BoxPlace): ProjectFields {
  const { parents, governorate } = placeContext(p);
  return { compound: '', compound_new: '', compound_ar: '', area_id: p.area_id ?? '', subzone_id: p.subzone_id ?? '', place_label: p.label || p.name_ar || p.name_en || '', place_path: parents, place_governorate: governorate };
}
/** A sub-area that is not on the list: its name, its Arabic name and the parent it is filed under until the CRM owner approves it. */
export function newSubareaPatch(name: string, ar: string, parent: BoxPlace): ProjectFields {
  const { parents, governorate } = placeContext(parent);
  const parentName = parent.label || parent.name_ar || parent.name_en || '';
  return { compound: name, compound_new: '1', compound_ar: ar, area_id: parent.area_id ?? '', subzone_id: parent.subzone_id ?? '', place_label: name, place_path: [parents, parentName].filter(Boolean).join(' › '), place_governorate: governorate };
}
export const NO_AREA: ProjectFields = { compound: '', compound_new: '', compound_ar: '', area_id: '', subzone_id: '', place_label: '', place_path: '', place_governorate: '' };

const FILLS = ['price_from', 'area_acres', 'down_pct_min', 'years_max', 'discount_pct', 'delivery_raw', 'delivery_year'] as const;

/** What a read launch message fills. Like the website, it never overwrites what the broker has already typed or picked. */
export function applyRead(f: ProjectFields, r: ProjectRead): ProjectFields {
  const out: ProjectFields = {};
  if (r.name && !text(f.name).trim()) out.name = r.name;
  if (r.name_en && !text(f.name_en).trim()) out.name_en = r.name_en;
  if (r.developer && !text(f.developer_label).trim()) {
    const d = r.developer as { id?: string; global_id?: string; name: string };
    Object.assign(out, developerPatch(d.id ? { id: d.id, name: d.name } : d.global_id ? { global_id: d.global_id, name: d.name } : { name: d.name }));
  }
  if (r.place && !hasPlace(f) && (r.place.kind === 'area' || r.place.kind === 'subzone')) Object.assign(out, areaPatch(r.place));
  const have = list(f.feature);
  const added = r.features.map((x) => x.key).filter((k) => !have.includes(k));
  if (added.length) out.feature = [...have, ...added];
  for (const k of FILLS) {
    const v = r.fields[k];
    if (v !== null && v !== undefined && v !== '' && !text(f[k]).trim()) out[k] = String(v);
  }
  if (r.fields.status === 'launching') out.status = 'launching';
  const beds = (r.fields.bedrooms ?? []).map(String).filter((b) => !list(f.bedrooms).includes(b));
  if (beds.length) out.bedrooms = [...list(f.bedrooms), ...beds];
  const types = (r.fields.property_types ?? []).filter((t) => !list(f.property_types).includes(t));
  if (types.length) out.property_types = [...list(f.property_types), ...types];
  return out;
}

/** The developer's three ways: one of the agency's (developer_id), a global name (developer_global_id) or a new private name (developer_name). */
export function developerPatch(d: { id?: string; global_id?: string; name: string } | null): ProjectFields {
  if (!d) return { developer_id: '', developer_global_id: '', developer_name: '', developer_label: '' };
  return { developer_id: d.id ?? '', developer_global_id: d.global_id ?? '', developer_name: d.id || d.global_id ? '' : d.name, developer_label: d.name };
}

/** The labels of what was read, for the line under the paste box ("Read from the message: name، developer"). */
export function foundLabels(found: string[], lang: Lang): string[] {
  const names: Record<string, [string, string]> = {
    name: ['الاسم', 'name'], developer: ['المطور', 'developer'], place: ['المكان', 'place'], features: ['المميزات', 'features'], area_acres: ['المساحة', 'size'],
    delivery_raw: ['الاستلام', 'delivery'], status: ['الحالة', 'status'], price_from: ['السعر يبدأ من', 'price from'], down_pct_min: ['المقدم', 'down payment'],
    years_max: ['السنين', 'years'], discount_pct: ['الخصم', 'discount'], bedrooms: ['الغرف', 'bedrooms'], property_types: ['النوع', 'types'],
    offers: ['وحدات بأسعارها', 'priced units'], facts: ['تفاصيل تانية', 'other details'], delivery_year: ['سنة الاستلام', 'delivery year'],
  };
  return found.map((k) => (names[k] ? names[k][lang === 'en' ? 1 : 0] : k));
}

/** The body posted to save: empty values and the screen-only keys left out. Numbers go as typed (the server reads Arabic digits and commas). */
export function projectBody(f: ProjectFields, pasted: string, isNew = false): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(f)) {
    if (UI_ONLY.includes(k) || v === undefined || v === false) continue;
    if (Array.isArray(v)) { if (v.length) out[k] = v; continue; }
    const s = String(v).trim();
    if (s !== '') out[k] = s;
  }
  // A new project always posts paste_text (even empty): that is what makes the server require the place, as on the website.
  if (pasted.trim() || isNew) out.paste_text = pasted.trim().slice(0, 8000);
  return out;
}

/** The form's values from a saved project (edit). */
export function fieldsOfProject(project: Record<string, unknown>, developer: Record<string, unknown> | null): ProjectFields {
  const s = (k: string) => str(project[k]);
  const f: ProjectFields = {
    name: s('name'), name_en: s('name_en'), status: s('status') || 'selling', price_from: s('price_from'), area_acres: s('area_acres'), down_pct_min: s('down_pct_min'),
    years_max: s('years_max'), discount_pct: s('discount_pct'), maintenance_pct: s('maintenance_pct'), delivery_year: s('delivery_year'), delivery_quarter: s('delivery_quarter'),
    delivery_raw: s('delivery_raw'), notes: s('notes'), area_id: s('area_id'), subzone_id: s('subzone_id'),
    bedrooms: Array.isArray(project.bedroom_options) ? (project.bedroom_options as unknown[]).map(String) : [],
    property_types: Array.isArray(project.property_types) ? (project.property_types as unknown[]).map(String) : [],
    feature: Array.isArray(project.feature_keys) ? (project.feature_keys as unknown[]).map(String) : [],
    features_other: Array.isArray(project.features_other) ? (project.features_other as unknown[]).map(String).join('، ') : s('features_other'),
    place_label: [s('district'), s('city')].filter(Boolean)[0] ?? '', place_path: '', place_governorate: s('city'),
    pin: project.lat !== null && project.lat !== undefined ? `${s('lat')}, ${s('lng')}` : '',
  };
  if (developer) Object.assign(f, developerPatch({ id: str(developer.id), name: str(developer.name) }));
  return f;
}
