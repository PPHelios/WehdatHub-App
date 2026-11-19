import { readPhone, readPrice, withCommas } from '../src/readback';

test('price in words', () => {
  expect(readPrice('9500000', 'en')).toBe('9.5 million');
  expect(readPrice('25k', 'en')).toBe('25 thousand');
  expect(readPrice('٩٥٠٠٠٠٠', 'ar')).toBe('9.5 مليون');
  expect(readPrice('abc', 'en')).toBe('');
});
test('phone spaced', () => {
  expect(readPhone('01012345678')).toBe('0101 234 5678');
  expect(readPhone('+201012345678')).toBe('0101 234 5678');
  expect(readPhone('123')).toBe('');
  expect(readPhone('+966 512345678')).toBe('+966512345678');
  expect(readPhone('00971551040978')).toBe('+971551040978');
});

test('thousands separators while typing', () => {
  expect(withCommas('9500000')).toBe('9,500,000');
  expect(withCommas('٩٥٠٠٠٠٠')).toBe('9,500,000');
  expect(withCommas('1,234.5')).toBe('1,234.5');
  expect(withCommas('abc')).toBe('');
});

import { readArea, readSum } from '../src/readback';
test('area typo guard and price per m²', () => {
  expect(readArea('10', '', false, 'en')).toContain('Very small');
  expect(readArea('5000', '', false, 'en')).toContain('Very large');
  expect(readArea('5000', '', true, 'en')).toBe('');
  expect(readArea('150', '9000000', false, 'en')).toBe('≈ 60,000 EGP per m²');
});
test('paid + remaining is a plain sum', () => {
  expect(readSum('3000000', '5500000', 'en')).toBe('Paid + remaining = 8,500,000');
  expect(readSum('3000000', '', 'en')).toBe('');
});
