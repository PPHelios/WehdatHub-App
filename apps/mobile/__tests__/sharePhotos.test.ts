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
  expect(await sharePhotos(urls, 'A-1\n9,000,000 EGP')).toBe('sent');
  const arg = (Share.open as jest.Mock).mock.calls[0][0];
  expect(arg.urls).toHaveLength(10);
  expect(arg.message).toBe('A-1\n9,000,000 EGP');
});

test('a download that fails reports failed, and a cancelled sheet is not an error', async () => {
  (globalThis as unknown as { fetch: unknown }).fetch = jest.fn().mockRejectedValue(new Error('offline'));
  expect(await sharePhotos(['https://x/1.jpg'], 't')).toBe('failed');
  (globalThis as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ blob: async () => ({}) });
  (Share.open as jest.Mock).mockRejectedValueOnce(new Error('User did not share'));
  expect(await sharePhotos(['https://x/1.jpg'], 't')).toBe('failed');
});
