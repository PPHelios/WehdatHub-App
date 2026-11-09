import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

export const DAY = 24 * 60 * 60 * 1000;
/** The last units, leads and today lists are kept on the phone so they still show with no signal. Logout clears them. */
export const listsStore = createAsyncStoragePersister({ storage: AsyncStorage, key: 'wh-lists' });
export const KEPT = ['units', 'unit', 'leads', 'lead', 'today'];
