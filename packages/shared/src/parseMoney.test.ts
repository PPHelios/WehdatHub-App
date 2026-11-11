import { describe, expect, it } from 'vitest';
import { parseMoney } from './format';

describe('parseMoney', () => {
  it('reads m, k, commas and Arabic digits like the website', () => {
    expect(parseMoney('5m')).toBe(5e6);
    expect(parseMoney('250k')).toBe(250e3);
    expect(parseMoney('5,000,000')).toBe(5e6);
    expect(parseMoney('٣m')).toBe(3e6);
    expect(parseMoney('1.5m')).toBe(1.5e6);
  });
  it('gives null for anything else', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('cheap')).toBeNull();
  });
});
