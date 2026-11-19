import ImageResizer from '@bam.tech/react-native-image-resizer';
import type { UploadFile } from '@wehdathub/shared';

// Same result the server's sharp step gave: longest side 1600 px, JPEG, rotation applied. Then kept under 500 KB.
const SIDE = 1600;
const LIMIT = 500 * 1024;
const QUALITIES = [82, 70, 60, 50, 40];
const done = new Set<string>();

export async function compressPhoto(f: UploadFile): Promise<UploadFile> {
  if (done.has(f.uri) || /^https?:/i.test(f.uri)) return f;
  try {
    let out = await ImageResizer.createResizedImage(f.uri, SIDE, SIDE, 'JPEG', QUALITIES[0], 0, undefined, false, { mode: 'contain', onlyScaleDown: true });
    for (let i = 1; out.size > LIMIT && i < QUALITIES.length; i++) {
      out = await ImageResizer.createResizedImage(f.uri, SIDE, SIDE, 'JPEG', QUALITIES[i], 0, undefined, false, { mode: 'contain', onlyScaleDown: true });
    }
    done.add(out.uri);
    return { uri: out.uri, name: f.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg' };
  } catch {
    return f; // unsupported or failed: send the original, the server resizes it
  }
}

export const compressPhotos = (files: UploadFile[], onEach?: (done: number, total: number) => void) => {
  let done = 0;
  return Promise.all(files.map(async (f) => { const r = await compressPhoto(f); onEach?.(++done, files.length); return r; }));
};

/**
 * Shrinks the photos at most `cap` at a time, in order, and returns one promise per photo (it never rejects). The caller uploads them one
 * after another and hands each promise to uploadPhoto, so photo n + 1 is shrunk while photo n is sent.
 */
export function compressAhead(files: UploadFile[], cap = 2): Promise<UploadFile>[] {
  let next = 0;
  const slots = files.map(() => { let settle!: (f: UploadFile) => void; const promise = new Promise<UploadFile>((r) => { settle = r; }); return { promise, settle }; });
  const worker = async () => {
    while (next < files.length) {
      const i = next++;
      slots[i].settle(await compressPhoto(files[i]));
    }
  };
  for (let w = 0; w < Math.min(cap, files.length); w++) void worker();
  return slots.map((s) => s.promise);
}
