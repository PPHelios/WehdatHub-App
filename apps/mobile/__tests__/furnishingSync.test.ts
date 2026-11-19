import { withFurnishingSync } from '../src/unitRules';

const apply = (prev: Record<string, unknown>, p: Record<string, unknown>) => withFurnishingSync(prev as never, { ...prev, ...p } as never) as { feature?: string[]; furnishing?: string };

test('adding AC then kitchen moves the furnishing field', () => {
  const a = apply({ feature: [], furnishing: '' }, { feature: ['ac_installed'] });
  expect(a.furnishing).toBe('ac_only');
  const b = apply(a, { feature: ['ac_installed', 'kitchen_installed'] });
  expect(b.furnishing).toBe('kitchen_and_ac');
  const c = apply(b, { feature: ['kitchen_installed'] });
  expect(c.furnishing).toBe('kitchen_only');
  expect(apply(c, { feature: [] }).furnishing).toBe('');
});

test('choosing a furnishing status sets the two features', () => {
  expect(apply({ feature: ['roof'], furnishing: '' }, { furnishing: 'kitchen_and_ac' }).feature).toEqual(['roof', 'kitchen_installed', 'ac_installed']);
  expect(apply({ feature: ['ac_installed', 'kitchen_installed'], furnishing: 'kitchen_and_ac' }, { furnishing: 'ac_only' }).feature).toEqual(['ac_installed']);
  expect(apply({ feature: ['ac_installed'], furnishing: 'ac_only' }, { furnishing: 'unfurnished' }).feature).toEqual([]);
});

test('furnished and semi-furnished are left alone', () => {
  expect(apply({ feature: [], furnishing: 'furnished' }, { feature: ['ac_installed'] }).furnishing).toBe('furnished');
  const f = apply({ feature: ['ac_installed'], furnishing: 'ac_only' }, { furnishing: 'furnished' });
  expect(f.feature).toEqual(['ac_installed']);
});
