import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

export const DAY = 24 * 60 * 60 * 1000;
/** The last units are kept on the phone so they still show with no signal. Leads and the today list hold client phone numbers, so they are never saved. Logout clears them. */
export const listsStore = createAsyncStoragePersister({ storage: AsyncStorage, key: 'wh-lists' });
export const KEPT = ['me', 'units', 'unit'];
