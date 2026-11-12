import { useCallback, useEffect, useRef } from 'react';
import { ApiClientError } from '@wehdathub/shared';
import type { PhotoUploadLink, UploadFile } from '@wehdathub/shared';
import { api } from './api';
import { uploadPhoto } from './photoUpload';

type SetPhotos = (f: (p: UploadFile[]) => UploadFile[]) => void;
const pending = (p: UploadFile) => p.type !== 'existing' && !p.key;

/**
 * Sends each new photo straight to storage as soon as it is added, one at a time, each with its own %.
 * An old server (no upload links) switches this off and the photos go with Save as before.
 */
export function usePhotoUploads(photos: UploadFile[], setPhotos: SetPhotos) {
  const busy = useRef<string | null>(null);
  const links = useRef<PhotoUploadLink[]>([]);
  const legacy = useRef(false);

  const patch = useCallback((uri: string, change: Partial<UploadFile>) => setPhotos((p) => p.map((x) => (x.uri === uri ? { ...x, ...change } : x))), [setPhotos]);

  useEffect(() => {
    if (legacy.current || busy.current) return;
    const next = photos.find((p) => pending(p) && !p.failed);
    if (!next) return;
    busy.current = next.uri;
    (async () => {
      try {
        if (!links.current.length) {
          const waiting = photos.filter((p) => pending(p) && !p.failed).length;
          links.current = (await api.photoUploadLinks(Math.max(1, Math.min(15, waiting)))).uploads;
        }
        const link = links.current[0];
        patch(next.uri, { pct: 0, failed: false });
        let last = -10;
        await uploadPhoto(next, link, (pct) => { if (pct - last >= 5 || pct === 100) { last = pct; patch(next.uri, { pct }); } });
        links.current = links.current.slice(1);
        patch(next.uri, { key: link.key, pct: 100 });
      } catch (e) {
        if (e instanceof ApiClientError && (e.status === 404 || e.status === 405)) legacy.current = true;
        else { links.current = []; patch(next.uri, { failed: true, pct: undefined }); }
      } finally {
        busy.current = null;
        // Nudge the effect for the next photo even when the list itself did not change.
        setPhotos((p) => [...p]);
      }
    })();
  }, [photos, patch, setPhotos]);

  const retry = useCallback((uri: string) => { links.current = []; patch(uri, { failed: false }); }, [patch]);
  const unfinished = photos.some((p) => pending(p)) && !legacy.current;
  return { retry, unfinished, hasFailed: photos.some((p) => p.failed) };
}
