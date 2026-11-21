import type { BoxPlace, UnitFields } from '@wehdathub/shared';
import { chipLabel, phasesOf, placePatch } from './unitBoxRules';
import { sendable } from './unitRules';

const madinaty: BoxPlace = {
  kind: 'compound', id: 'c1', label: 'Madinaty', name_ar: 'مدينتي', name_en: 'Madinaty', path: 'Cairo · New Cairo', via: 'name',
  area_id: 'a1', subzone_id: null, zones: [], score: 1,
  phasesBase: '',
  phases: [{ id: 'p10', label: 'B10', selected: false }, { id: 'p6', label: 'B6', selected: false }],
} as unknown as BoxPlace;

describe('unit box rules', () => {
  it('a picked compound with no phase files the unit under the compound (no sub-zone)', () => {
    const p = placePatch(madinaty);
    expect(p.compound).toBe('Madinaty');
    expect(p.subzone_id).toBe('');
    expect(p.phase_label).toBe('');
  });

  it('a picked phase becomes the sub-zone and the chip shows it', () => {
    const picked = { ...madinaty, phases: madinaty.phases!.map((x) => ({ ...x, selected: x.id === 'p10' })) };
    const p = placePatch(picked);
    expect(p.subzone_id).toBe('p10');
    expect(p.phase_label).toBe('B10');
    expect(chipLabel(p)).toBe('Madinaty · B10');
  });

  it('the chip does not repeat the place when the phase has the same name', () => {
    expect(chipLabel({ place_label: 'B10', phase_label: 'B10' })).toBe('B10');
  });

  it('phase data round-trips through the saved place_phases field', () => {
    const p = placePatch({ ...madinaty, phasesBase: 'a1' });
    expect(phasesOf(p).base).toBe('a1');
    expect(phasesOf(p).list.map((x) => x.label)).toEqual(['B10', 'B6']);
    expect(phasesOf({ place_phases: 'not json' })).toEqual({ base: '', list: [] });
  });

  it('phone-only phase fields are not sent to the server on save', () => {
    const fields: UnitFields = { compound: 'Madinaty', subzone_id: 'p10', phase_label: 'B10', place_phases: '{}', price_value: '100' };
    const sent = sendable(fields);
    expect(sent).not.toHaveProperty('phase_label');
    expect(sent).not.toHaveProperty('place_phases');
    expect(sent.subzone_id).toBe('p10');
  });
});
