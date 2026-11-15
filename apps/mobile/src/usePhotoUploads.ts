import { useCallback, useRef } from 'react';
import { ApiClientError } from '@wehdathub/shared';
import type { PhotoUploadLink, UploadFile } from '@wehdathub/shared';
import { api } from './api';
import { uploadPhoto } from './photoUpload';

type SetPhotos = (f: (p: UploadFile[]) => UploadFile[]) => void;
const pending = (p: UploadFile) => p.type !== 'existing' && !p.key && !p.notKept;

/**
 * Sends the kept photos straight to storage when Save is pressed (never while picking), one at a time, each with its own %.
 * An old server (no upload links) switches this off and the photos go with Save as before.
 * onProgress(done, total, fraction 0 to 1) feeds the Save button and the slow-connection note. Resolves when every kept
 * photo is in storage (or the old way applies), false when one failed (it shows a retry arrow and Save can be pressed again).
 * Resolves the kept photos with their storage keys (the screen's own copy of the list may not have caught up yet), or null on a failure.
 */
export function usePhotoUploads(photos: UploadFile[], setPhotos: SetPhotos) {
  const latest = useRef(photos);
  latest.current = photos;
  const legacy = useRef(false);

  const patch = useCallback((uri: string, change: Partial<UploadFile>) => setPhotos((p) => p.map((x) => (x.uri === uri ? { ...x, ...change } : x))), [setPhotos]);

  const uploadAll = useCallback(async (onProgress: (done: number, total: number, fraction: number) => void): Promise<UploadFile[] | null> => {
    const keptNow = () => latest.current.filter((p) => !p.notKept);
    const todo = latest.current.filter(pending);
    if (!todo.length || legacy.current) return keptNow();
    const keys: Record<string, string> = {};
    let links: PhotoUploadLink[];
    try {
      links = (await api.photoUploadLinks(Math.max(1, Math.min(15, todo.length)))).uploads;
    } catch (e) {
      if (e instanceof ApiClientError && (e.status === 404 || e.status === 405)) { legacy.current = true; return keptNow(); }
      return null;
    }
    let done = 0;
    for (const file of todo) {
      const link = links.shift();
      if (!link) return null;
      let last = -10;
      try {
        patch(file.uri, { pct: 0, failed: false });
        await uploadPhoto(file, link, (pct) => {
          onProgress(done, todo.length, (done + pct / 100) / todo.length);
          if (pct - last >= 5 || pct === 100) { last = pct; patch(file.uri, { pct }); }
        });
        keys[file.uri] = link.key;
        patch(file.uri, { key: link.key, pct: 100 });
        done += 1;
        onProgress(done, todo.length, done / todo.length);
      } catch {
        patch(file.uri, { failed: true, pct: undefined });
        return null;
      }
    }
    return keptNow().map((p) => (keys[p.uri] ? { ...p, key: keys[p.uri], pct: 100 } : p));
  }, [patch]);

  const retry = useCallback((uri: string) => patch(uri, { failed: false }), [patch]);
  return { uploadAll, retry, hasFailed: photos.some((p) => p.failed) };
}
