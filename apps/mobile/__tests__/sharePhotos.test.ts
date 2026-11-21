import Share from 'react-native-share';
import { sharePhotos } from '../src/sharePhotos';

class FakeReader {
  result: string | null = null;
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL() { this.result = 'data:image/jpeg;base64,AA'; this.onloadend?.(); }
}

beforeEach(() => {
  (globalThis as unknown as { FileReader: unknown }).FileReader = FakeReader;
  (globalThis as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ blob: async () => ({}) });
  (Share.open as jest.Mock).mockClear();
});

test('sends at most 10 photos with the text', async () => {
  const urls = Array.from({ length: 12 }, (_v, i) => `https://x/${i}.jpg`);
  expect(await sharePhotos(urls, 'A-1\n9,000,000 EGP', 'unit_share')).toBe('sent');
  const arg = (Share.open as jest.Mock).mock.calls[0][0];
  expect(arg.urls).toHaveLength(10);
  expect(arg.message).toBe('A-1\n9,000,000 EGP');
});

test('pictures go to internal storage, or Android shares no file and WhatsApp does nothing', async () => {
  await sharePhotos(['https://x/1.jpg'], '', 'unit_share');
  expect((Share.open as jest.Mock).mock.calls[0][0].useInternalStorage).toBe(true);
});

test('a download that fails reports failed, and a cancelled sheet is not an error', async () => {
  (globalThis as unknown as { fetch: unknown }).fetch = jest.fn().mockRejectedValue(new Error('offline'));
  expect(await sharePhotos(['https://x/1.jpg'], 't', 'unit_share')).toBe('failed');
  (globalThis as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ blob: async () => ({}) });
  (Share.open as jest.Mock).mockRejectedValueOnce(new Error('User did not share'));
  expect(await sharePhotos(['https://x/1.jpg'], 't', 'unit_share')).toBe('failed');
});

test('a picture never goes out as application/octet-stream (that became a .bin file)', async () => {
  (globalThis as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ headers: { get: () => 'application/octet-stream' }, blob: async () => ({ type: 'application/octet-stream' }) });
  await sharePhotos(['https://x/1.jpg'], '', 'unit_share');
  const arg = (Share.open as jest.Mock).mock.calls[0][0];
  expect(arg.urls[0]).toMatch(/^data:image\/jpeg;base64,/);
  expect(arg.type).toBe('image/jpeg');
});

test('one picture is shared with its image type, several with image/*', async () => {
  await sharePhotos(['https://x/f.png'], '', 'flyer_share');
  expect((Share.open as jest.Mock).mock.calls[0][0].type).toBe('image/jpeg');
  await sharePhotos(['https://x/1.jpg', 'https://x/2.jpg'], '', 'unit_share');
  expect((Share.open as jest.Mock).mock.calls[1][0].type).toBe('image/*');
});
