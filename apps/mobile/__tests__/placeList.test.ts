import { api } from '../src/api';
import { clearPlaces, matchPlaces, syncPlaces, usePlaces } from '../src/placeList';

jest.mock('../src/api', () => ({ api: { placeList: jest.fn() } }));
const m = api as unknown as { placeList: jest.Mock };
const list = {
  version: 'v1',
  areas: [{ id: 'a1', parent_id: null, name_en: 'New Cairo', name_ar: 'القاهرة الجديدة', aliases: ['التجمع'], lat: 30, lng: 31.4 }],
  places: [{ id: 'p1', name_en: 'Mivida', name_ar: 'ميفيدا', aliases: [], area_id: 'a1', subzone_id: null, lat: 30, lng: 31.5 }],
};

beforeEach(async () => {
  jest.clearAllMocks();
  await clearPlaces();
});

test('the list is downloaded once, then only the version is checked', async () => {
  m.placeList.mockResolvedValueOnce(list);
  await syncPlaces();
  expect(matchPlaces('mivida')?.[0].id).toBe('p1');
  m.placeList.mockResolvedValueOnce({ version: 'v1', unchanged: true });
  await syncPlaces(true);
  expect(m.placeList).toHaveBeenLastCalledWith('v1');
  expect(usePlaces.getState().list?.version).toBe('v1');
});

test('a new version replaces the list and an approved name drops its local pending copy', async () => {
  m.placeList.mockResolvedValueOnce(list);
  await syncPlaces();
  usePlaces.setState({ pending: [{ id: 'pending:Mivida', name_en: 'Mivida', name_ar: null, aliases: [], area_id: null, subzone_id: null, lat: null, lng: null }] });
  m.placeList.mockResolvedValueOnce({ ...list, version: 'v2' });
  await syncPlaces(true);
  expect(usePlaces.getState().list?.version).toBe('v2');
  expect(usePlaces.getState().pending).toHaveLength(0);
});

test('a failed check keeps the saved list, and sign-out clears it', async () => {
  m.placeList.mockResolvedValueOnce(list);
  await syncPlaces();
  m.placeList.mockRejectedValueOnce(new Error('offline'));
  await syncPlaces(true);
  expect(matchPlaces('mivida')).not.toBeNull();
  await clearPlaces();
  expect(matchPlaces('mivida')).toBeNull();
});
