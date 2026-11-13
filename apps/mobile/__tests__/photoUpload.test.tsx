import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import type { UploadFile } from '@wehdathub/shared';
import { api } from '../src/api';
import { putBytes, uploadPhoto } from '../src/photoUpload';
import { usePhotoUploads } from '../src/usePhotoUploads';

jest.mock('../src/api', () => ({ api: { photoUploadLinks: jest.fn() } }));
jest.mock('../src/photoUpload', () => ({ ...jest.requireActual('../src/photoUpload'), uploadPhoto: jest.fn() }));
const m = api as unknown as { photoUploadLinks: jest.Mock };
const up = uploadPhoto as jest.Mock;
const link = (k: string) => ({ key: k, upload_url: `https://s/${k}`, thumb_key: `t${k}`, thumb_upload_url: null });
const photo = (n: string): UploadFile => ({ uri: `file:///${n}.jpg`, name: `${n}.jpg`, type: 'image/jpeg' });

class FakeXhr {
  static last: FakeXhr;
  upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  status = 200; onload?: () => void; onerror?: () => void; timeout = 0; ontimeout?: () => void;
  headers: Record<string, string> = {};
  open = jest.fn(); setRequestHeader = (k: string, v: string) => { this.headers[k] = v; };
  send = jest.fn(() => { FakeXhr.last = this; });
}

test('putBytes reports progress and resolves on a 2xx answer', async () => {
  (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;
  const seen: number[] = [];
  const p = putBytes('https://s/x', {} as Blob, (n) => seen.push(n));
  FakeXhr.last.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
  FakeXhr.last.onload?.();
  await p;
  expect(seen).toEqual([50]);
  expect(FakeXhr.last.headers['Content-Type']).toBe('image/jpeg');
});

test('putBytes rejects on a refused upload', async () => {
  (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;
  const p = putBytes('https://s/x', {} as Blob, () => undefined);
  FakeXhr.last.status = 403;
  FakeXhr.last.onload?.();
  await expect(p).rejects.toThrow('upload_403');
});

beforeEach(() => {
  jest.clearAllMocks();
  m.photoUploadLinks.mockImplementation(async () => ({ uploads: [link('k1'), link('k2')], expires_in: 7200 })); // a fresh list per call
  up.mockImplementation(async (_f: UploadFile, _l: unknown, onPct: (n: number) => void) => { onPct(50); onPct(100); });
});

function useList(initial: UploadFile[]) {
  const [photos, setPhotos] = React.useState(initial);
  return { photos, ...usePhotoUploads(photos, setPhotos) };
}

test('nothing uploads while picking; uploadAll sends the kept photos one by one and skips the not-kept ones', async () => {
  const { result } = await renderHook(() => useList([photo('a'), photo('b'), { ...photo('c'), notKept: true }]));
  expect(up).not.toHaveBeenCalled();
  let files: UploadFile[] | null = null;
  await act(async () => { files = await result.current.uploadAll(() => undefined); });
  expect(files!.map((p) => p.key)).toEqual(['k1', 'k2']);
  expect(m.photoUploadLinks).toHaveBeenCalledWith(2);
  expect(up).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(result.current.photos.map((p) => p.key)).toEqual(['k1', 'k2', undefined]));
});

test('a failed upload stops there, shows as failed, and retry then Save tries it again', async () => {
  up.mockRejectedValueOnce(new Error('upload_403'));
  const { result } = await renderHook(() => useList([photo('a')]));
  let files: UploadFile[] | null = [];
  await act(async () => { files = await result.current.uploadAll(() => undefined); });
  expect(files).toBeNull();
  await waitFor(() => expect(result.current.photos[0].failed).toBe(true));
  expect(result.current.hasFailed).toBe(true);
  await act(async () => { result.current.retry(result.current.photos[0].uri); });
  await act(async () => { files = await result.current.uploadAll(() => undefined); });
  expect(files!.map((p) => p.key)).toEqual(['k1']);
});
