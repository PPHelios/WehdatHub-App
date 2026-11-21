import type { BoxPhase, BoxPlace, BoxResolve, UnitFields } from '@wehdathub/shared';

// The box's pure rules (no UI, no API): what a picked place, phase or pasted message writes into the unit's fields.

export const str = (v: UnitFields[string]): string => (typeof v === 'string' ? v : '');
export const featureKeys = (f: UnitFields): string[] => (Array.isArray(f.feature) ? f.feature : []);
export const otherFeatures = (f: UnitFields): string[] => str(f.features_other).split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
/** The place the box shows: the compound, or the sub-area or area the unit is filed under. */
export const placeLabel = (f: UnitFields): string => str(f.place_label) || str(f.compound);
/** The chip text: the place with its phase, "Madinaty · B10". */
export const chipLabel = (f: UnitFields): string => {
  const place = placeLabel(f);
  const phase = str(f.phase_label);
  return phase && phase !== place ? `${place} · ${phase}` : place;
};
/** A compound's phases as the server sent them with the picked place: the list and the sub-zone a tap on the chosen phase goes back to. */
export const phasesOf = (f: UnitFields): { base: string; list: BoxPhase[] } => {
  try {
    const v = JSON.parse(str(f.place_phases) || 'null');
    return v && Array.isArray(v.list) ? { base: String(v.base ?? ''), list: v.list } : { base: '', list: [] };
  } catch {
    return { base: '', list: [] };
  }
};

export const nameOf = (p: BoxPlace) => p.label || p.name_ar || p.name_en || '';

/** The fields a picked place writes. A compound brings its own area; an area or sub-zone leaves the compound empty. A picked phase is the sub-zone. */
export function placePatch(p: BoxPlace): UnitFields {
  const sel = p.phases?.find((x) => x.selected);
  return {
    compound: p.kind === 'compound' ? nameOf(p) : '',
    compound_new: '',
    area_id: p.area_id ?? '',
    subzone_id: sel ? sel.id : (p.subzone_id ?? ''),
    place_label: nameOf(p),
    place_path: p.path,
    place_zones: (p.zones ?? []).join(' · '),
    phase_label: sel ? sel.label : '',
    place_phases: p.phases?.length ? JSON.stringify({ base: p.phasesBase ?? '', list: p.phases }) : '',
  };
}

/** What a pasted message adds: its place (only when none is set yet) and its features, without repeats. */
export function resolvePatch(r: BoxResolve, f: UnitFields): UnitFields {
  const out: UnitFields = {};
  if (r.place && !placeLabel(f)) Object.assign(out, placePatch(r.place));
  const keys = featureKeys(f);
  const added = r.features.map((x) => x.key).filter((k) => !keys.includes(k));
  if (added.length) out.feature = [...keys, ...added];
  // The two drop-downs fill from the message only while they are empty: a choice already made stays.
  if (r.furnishing && !str(f.furnishing)) out.furnishing = r.furnishing;
  if (r.finishing && !str(f.finishing)) out.finishing = r.finishing;
  return out;
}

/** The fields that clear the place (its chip, its area and the new-place fields). */
export const NO_PLACE: UnitFields = { compound: '', compound_new: '', area_id: '', subzone_id: '', place_label: '', place_path: '', place_zones: '', phase_label: '', place_phases: '' };

