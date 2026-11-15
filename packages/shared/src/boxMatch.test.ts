import { describe, expect, test } from 'vitest';
import { boxSuggest, suggestFeatures, type ListArea, type ListFeature, type ListPlace, type ListZone } from './placeMatch';

const areas: ListArea[] = [
  { id: 'a1', parent_id: null, name_en: 'New Cairo', name_ar: 'القاهرة الجديدة', aliases: [], lat: null, lng: null },
  { id: 's5', parent_id: 'a1', name_en: '5th Settlement', name_ar: 'التجمع الخامس', aliases: [], lat: null, lng: null },
  { id: 'gs', parent_id: 'a1', name_en: 'Golden Square', name_ar: 'المربع الذهبي', aliases: [], lat: null, lng: null },
];
const places: ListPlace[] = [{ id: 'p1', name_en: 'Hyde Park', name_ar: 'هايد بارك', aliases: [], area_id: 'a1', subzone_id: 's5', lat: null, lng: null }];
const zones: ListZone[] = [{ place_id: 'p1', area_id: 'gs' }];
const features: ListFeature[] = [
  { key: 'roof', ar: 'روف', en: 'Roof', syn: ['روف', 'roof'] },
  { key: 'north_facing', ar: 'بحري', en: 'North facing', syn: ['بحري', 'north facing', 'north'] },
  { key: 'view_landscape', ar: 'فيو لاندسكيب', en: 'Landscape view', syn: ['view landscape'] },
];
const list = { places, areas, zones, features };

describe('the box answers on the phone like the server', () => {
  test('a compound carries its parents and zones in the language asked', () => {
    const [hyde] = boxSuggest('hyde', list, 'en');
    expect(hyde).toMatchObject({ kind: 'compound', id: 'p1', label: 'Hyde Park', path: 'New Cairo › 5th Settlement', zones: ['Golden Square'], area_id: 'a1', subzone_id: 's5' });
    const [ar] = boxSuggest('هايد', list, 'ar');
    expect(ar).toMatchObject({ label: 'هايد بارك', path: 'القاهرة الجديدة › التجمع الخامس', zones: ['المربع الذهبي'] });
  });

  test('a sub-area shows its parent area and has no zones', () => {
    const [gs] = boxSuggest('golden', list, 'en');
    expect(gs).toMatchObject({ kind: 'subzone', id: 'gs', label: 'Golden Square', path: 'New Cairo', zones: [], area_id: 'a1', subzone_id: 'gs' });
  });

  test('places come before features', () => {
    const items = boxSuggest('roof', list, 'en');
    expect(items.map((i) => i.kind)).toEqual(['feature']);
    const mixed = boxSuggest('nor', { ...list, places: [{ ...places[0], id: 'p2', name_en: 'North Park', name_ar: null }] }, 'en');
    expect(mixed.map((i) => i.kind)).toEqual(['compound', 'feature']);
  });

  test('without zones or features in a saved list, only places come back', () => {
    const items = boxSuggest('hyde', { places, areas }, 'en');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ zones: [] });
  });
});

describe('feature suggestions', () => {
  test('an exact word ranks first, then a start, then a part', () => {
    expect(suggestFeatures('roof', features, 'en').map((f) => f.key)).toEqual(['roof']);
    expect(suggestFeatures('north', features, 'en').map((f) => f.key)).toEqual(['north_facing']);
    expect(suggestFeatures('land', features, 'en').map((f) => f.key)).toEqual(['view_landscape']);
  });

  test('Arabic matches the label, and the label is in the language asked', () => {
    expect(suggestFeatures('بحري', features, 'ar')).toEqual([{ kind: 'feature', key: 'north_facing', label: 'بحري' }]);
    expect(suggestFeatures('بحري', features, 'en')[0].label).toBe('North facing');
  });

  test('a short text, or nothing that matches, gives nothing', () => {
    expect(suggestFeatures('r', features, 'en')).toEqual([]);
    expect(suggestFeatures('zzz', features, 'en')).toEqual([]);
  });
});
