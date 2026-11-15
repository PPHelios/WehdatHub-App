import { describe, expect, it } from 'vitest';
import { formatEgp } from './format';
import { brand } from './brand';

describe('shared', () => {
  it('formats pounds with separators', () => {
    expect(formatEgp(3180590)).toBe('3,180,590');
    expect(formatEgp(159029.4)).toBe('159,029');
  });
  it('has both themes', () => {
    expect(brand.light.copper).not.toBe(brand.dark.copper);
  });
});
