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
});

test('thousands separators while typing', () => {
  expect(withCommas('9500000')).toBe('9,500,000');
  expect(withCommas('٩٥٠٠٠٠٠')).toBe('9,500,000');
  expect(withCommas('1,234.5')).toBe('1,234.5');
  expect(withCommas('abc')).toBe('');
});
