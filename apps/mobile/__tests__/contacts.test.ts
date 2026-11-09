import { filterContacts, type PhoneContact } from '../src/contacts';
import { waNumber } from '../src/screens/UnitScreen';

const list: PhoneContact[] = [{ id: '1', name: 'Ahmed Samir', phone: '010 1234 5678' }, { id: '2', name: 'Mona', phone: '+20 111 222 3333' }];

test('contacts filter by name or digits', () => {
  expect(filterContacts(list, '').length).toBe(2);
  expect(filterContacts(list, 'ahm').map((c) => c.id)).toEqual(['1']);
  expect(filterContacts(list, '1234').map((c) => c.id)).toEqual(['1']);
  expect(filterContacts(list, '22').map((c) => c.id)).toEqual([]);
});

test('whatsapp numbers get the Egypt code', () => {
  expect(waNumber('01012345678')).toBe('201012345678');
  expect(waNumber('+20 101 234 5678')).toBe('201012345678');
  expect(waNumber('0020101234567')).toBe('20101234567');
});
