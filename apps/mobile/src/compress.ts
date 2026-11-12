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
