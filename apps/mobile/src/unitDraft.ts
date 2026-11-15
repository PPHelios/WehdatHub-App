import type { UnitFields } from '@wehdathub/shared';

// The description for clients, written from the unit's own fields (web/static/unitFields.js draftText). The screen keeps it
// current while the description is empty or still the draft; once the broker types in it, it stays theirs.

export interface DraftLabels {
  /** The unit type as the person reads it, e.g. "Apartment" or "شقة". */
  type: string;
  /** The place the box shows (compound, sub-area or area), or ''. */
  place: string;
  finishing: string;
  furnishing: string;
  /** The features the box shows as chips. */
  features: string[];
}

const num = (v: UnitFields[string]) => {
  const n = Number(v);
  return n > 0 ? n : 0;
};
const text = (v: UnitFields[string]) => (typeof v === 'string' ? v : '');

const bedroomsAr = (n: number) => (n > 10 ? 'غرفة' : n > 2 ? 'غرف نوم' : n === 2 ? 'غرفتين نوم' : 'غرفة نوم');
const bathroomsAr = (n: number) => (n > 10 ? 'حمام' : n > 2 ? 'حمامات' : n === 2 ? 'حمامين' : 'حمام');

export function draftText(fields: UnitFields, l: DraftLabels, en: boolean): string {
  const rent = fields.listing_type === 'rent';
  const sale = fields.listing_type === 'sale';
  const head = [l.type, rent ? (en ? 'for rent' : 'للإيجار') : sale ? (en ? 'for sale' : 'للبيع') : ''].filter(Boolean).join(' ');
  const headFull = head && l.place ? `${head}${en ? ' in ' : ' في '}${l.place}` : head;

  const parts: string[] = [];
  const area = num(fields.area_value);
  const beds = num(fields.bedrooms);
  const baths = num(fields.bathrooms);
  if (area) parts.push(en ? `${area} m²` : `مساحة ${area} م²`);
  if (num(fields.land_area)) parts.push(en ? `land ${num(fields.land_area)} m²` : `أرض ${num(fields.land_area)} م²`);
  if (beds) parts.push(en ? `${beds} ${beds === 1 ? 'bedroom' : 'bedrooms'}` : `${beds} ${bedroomsAr(beds)}`);
  if (baths) parts.push(en ? `${baths} ${baths === 1 ? 'bathroom' : 'bathrooms'}` : `${baths} ${bathroomsAr(baths)}`);
  const floor = text(fields.floor_level);
  if (floor !== '' && !Number.isNaN(Number(floor))) parts.push(Number(floor) === 0 ? (en ? 'ground floor' : 'الدور الأرضي') : `${en ? 'floor' : 'الدور'} ${Number(floor)}`);
  if (num(fields.garden_area)) parts.push(en ? `garden ${num(fields.garden_area)} m²` : `جنينة ${num(fields.garden_area)} م²`);
  if (num(fields.roof_area)) parts.push(en ? `roof ${num(fields.roof_area)} m²` : `روف ${num(fields.roof_area)} م²`);
  if (l.finishing) parts.push(en ? `${l.finishing} finishing` : `تشطيب ${l.finishing}`);
  if (l.furnishing) parts.push(l.furnishing);
  if (sale) {
    if (fields.is_ready === '1') parts.push(en ? 'ready to move' : 'استلام فوري');
    else if (text(fields.delivery_year)) parts.push(en ? `delivery ${text(fields.delivery_year)}` : `تسليم ${text(fields.delivery_year)}`);
  }

  const sep = en ? ', ' : '، ';
  let out = headFull;
  if (parts.length) out += (out ? '. ' : '') + parts.join(sep);
  if (l.features.length) out += (out ? '. ' : '') + l.features.join(sep);
  return out ? `${out}.` : '';
}

/** Whether the description still follows the fields: it is empty, or only the last draft (the screen sets this). */
export const isAutoDraft = (description: string) => description.trim() === '';
