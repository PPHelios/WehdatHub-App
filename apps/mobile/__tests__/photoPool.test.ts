import type { UploadFile } from '@wehdathub/shared';
import { MAX_PHOTOS, MAX_POOL, addPicked, toggleKeep } from '../src/photos';

const photo = (n: number): UploadFile => ({ uri: `file:///${n}.jpg`, name: `${n}.jpg`, type: 'image/jpeg' });
const many = (n: number, from = 0) => Array.from({ length: n }, (_x, i) => photo(from + i));

test('up to 60 photos are picked and only the first 15 start as kept', () => {
  const list = addPicked([], many(70));
  expect(list).toHaveLength(MAX_POOL);
  expect(list.filter((p) => !p.notKept)).toHaveLength(MAX_PHOTOS);
  expect(list[MAX_PHOTOS].notKept).toBe(true);
});

test('a photo cannot be kept while 15 are kept; dropping one makes room', () => {
  const list = addPicked([], many(20));
  expect(toggleKeep(list, list[16].uri)).toBe(list);
  const dropped = toggleKeep(list, list[0].uri);
  expect(dropped.filter((p) => !p.notKept)).toHaveLength(14);
  const swapped = toggleKeep(dropped, list[16].uri);
  expect(swapped.filter((p) => !p.notKept)).toHaveLength(15);
  expect(swapped[16].notKept).toBe(false);
});
