import ImageResizer from '@bam.tech/react-native-image-resizer';
import { compressPhoto } from '../src/compress';

const mock = ImageResizer.createResizedImage as jest.Mock;
const file = { uri: 'file:///a.heic', name: 'a.heic', type: 'image/heic' };

test('every photo is re-encoded to 1600 px JPEG', async () => {
  const r = await compressPhoto(file);
  expect(mock).toHaveBeenCalledWith(file.uri, 1600, 1600, 'JPEG', 82, 0, undefined, false, expect.anything());
  expect(r).toMatchObject({ type: 'image/jpeg', name: 'a.jpg' });
});

test('lowers quality until under 500 KB', async () => {
  mock.mockReset();
  mock.mockResolvedValueOnce({ uri: 'file:///b1', size: 900000 }).mockResolvedValueOnce({ uri: 'file:///b2', size: 400000 });
  const r = await compressPhoto({ ...file, uri: 'file:///b.jpg' });
  expect(mock).toHaveBeenCalledTimes(2);
  expect(mock.mock.calls[1][4]).toBe(70);
  expect(r.uri).toBe('file:///b2');
});

test('sends the original when compression fails', async () => {
  mock.mockReset();
  mock.mockRejectedValueOnce(new Error('bad'));
  const f = { ...file, uri: 'file:///c.jpg' };
  expect(await compressPhoto(f)).toBe(f);
});
