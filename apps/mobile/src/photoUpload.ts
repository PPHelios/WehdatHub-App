import ImageResizer from '@bam.tech/react-native-image-resizer';
import type { PhotoUploadLink, UploadFile } from '@wehdathub/shared';
import { compressPhoto } from './compress';

/** PUT the bytes to a one-time storage link, reporting 0 to 100 as they go. Rejects on any non-2xx answer or network error. */
export function putBytes(url: string, body: Blob, onPct: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'image/jpeg');
    // Some phones count a few bytes more than the file, so the percent is capped at 100.
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && e.total) onPct(Math.min(100, Math.round((e.loaded / e.total) * 100))); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload_${xhr.status}`)));
    xhr.onerror = () => reject(new Error('upload_network'));
    xhr.ontimeout = () => reject(new Error('upload_timeout'));
    xhr.timeout = 120000;
    xhr.send(body);
  });
}

const blobOf = async (uri: string): Promise<Blob> => (await fetch(uri)).blob();

/**
 * One photo: shrink it (1600 px JPEG), send it, then its small 360x270 copy for lists. The photo is 0 to 90%, the small copy the rest.
 * A failed small copy does not fail the photo. Throws when the photo itself could not be sent.
 */
export async function uploadPhoto(file: UploadFile, link: PhotoUploadLink, onPct: (pct: number) => void): Promise<void> {
  const small = await compressPhoto(file);
  await putBytes(link.upload_url, await blobOf(small.uri), (p) => onPct(Math.round(p * 0.9)));
  onPct(90);
  if (link.thumb_upload_url) {
    try {
      const t = await ImageResizer.createResizedImage(small.uri, 360, 270, 'JPEG', 70, 0, undefined, false, { mode: 'cover', onlyScaleDown: true });
      await putBytes(link.thumb_upload_url, await blobOf(t.uri), () => undefined);
    } catch {
      /* the list falls back to the full photo */
    }
  }
  onPct(100);
}
