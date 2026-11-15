import { PermissionsAndroid, Platform } from 'react-native';
import Contacts from 'react-native-contacts';

export interface PhoneContact { id: string; name: string; phone: string }

/** The phone's contacts that have a number, sorted by name. Returns null when the person said no. */
export async function loadContacts(): Promise<PhoneContact[] | null> {
  if (Platform.OS === 'android') {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
    if (r !== PermissionsAndroid.RESULTS.GRANTED) return null;
  } else {
    const r = await Contacts.requestPermission();
    if (r !== 'authorized' && r !== 'limited') return null;
  }
  const all = await Contacts.getAllWithoutPhotos();
  const out: PhoneContact[] = [];
  for (const c of all) {
    const phone = c.phoneNumbers?.[0]?.number;
    if (!phone) continue;
    out.push({ id: c.recordID, name: (c.displayName || [c.givenName, c.familyName].filter(Boolean).join(' ')).trim(), phone });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Contacts matching what was typed, by name or digits. */
export function filterContacts(list: PhoneContact[], text: string): PhoneContact[] {
  const q = text.trim().toLowerCase();
  if (!q) return list;
  const digits = q.replace(/\D/g, '');
  return list.filter((c) => c.name.toLowerCase().includes(q) || (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits)));
}
