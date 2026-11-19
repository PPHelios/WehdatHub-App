import { describe, expect, it } from 'vitest';
import { displayPhone, looksLikePhone, ltr } from './phone';

describe('displayPhone', () => {
  it('formats egyptian mobiles', () => {
    expect(displayPhone('+20 11 11616455')).toBe('0111 161 6455');
    expect(displayPhone('+201111616455')).toBe('0111 161 6455');
    expect(displayPhone('01012345678')).toBe('0101 234 5678');
    expect(displayPhone('0101 234 5622')).toBe('0101 234 5622');
    expect(displayPhone('00201012345678')).toBe('0101 234 5678');
  });
  it('handles arabic digits', () => {
    expect(displayPhone('٠١٠١٢٣٤٥٦٧٨')).toBe('0101 234 5678');
  });
  it('formats landlines and foreign numbers', () => {
    expect(displayPhone('0212345678')).toBe('02 1234 5678');
    expect(displayPhone('+966512345678')).toBe('+966512345678');
  });
  it('passes non-phones through', () => {
    expect(displayPhone('أحمد')).toBe('أحمد');
    expect(displayPhone('')).toBe('');
  });
});

describe('ltr / looksLikePhone', () => {
  it('wraps', () => expect(ltr('1 2')).toBe('‪1 2‬'));
  it('detects phones', () => {
    expect(looksLikePhone('+20 11 11616455')).toBe(true);
    expect(looksLikePhone('0101 234 5622')).toBe(true);
    expect(looksLikePhone('123')).toBe(false);
    expect(looksLikePhone('Ahmed 01012345678')).toBe(false);
  });
});
