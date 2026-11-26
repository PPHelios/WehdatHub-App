import { describe, expect, it } from 'vitest';
import { currencyLabel, formatEgp, formatUnitPrice } from './format';
import { brand } from './brand';

describe('shared', () => {
  it('formats pounds with separators', () => {
    expect(formatEgp(3180590)).toBe('3,180,590');
    expect(formatEgp(159029.4)).toBe('159,029');
  });
  it('formats multi-currency unit prices in Arabic and English', () => {
    expect(currencyLabel('usd', 'en')).toBe('USD');
    expect(currencyLabel('usd', 'ar')).toBe('دولار');
    expect(currencyLabel('eur', 'ar')).toBe('يورو');
    expect(formatUnitPrice(250000, { currency: 'USD', lang: 'en' })).toBe('250,000 USD');
    expect(formatUnitPrice(250000, { currency: 'USD', lang: 'ar' })).toBe('250,000 دولار');
    expect(formatUnitPrice(1200, { currency: 'EUR', lang: 'en', dealType: 'rent', rentPeriod: 'monthly' })).toBe('1,200 EUR / month');
    expect(formatUnitPrice(null, { fallbackText: 'Price on ask' })).toBe('Price on ask');
  });
  it('has both themes', () => {
    expect(brand.light.gold).not.toBe(brand.dark.gold);
  });
});
