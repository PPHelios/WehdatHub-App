import { readPhone, readPrice } from '../src/readback';

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
