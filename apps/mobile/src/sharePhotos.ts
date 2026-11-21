import Share from 'react-native-share';
import { usage, UsageEvent } from './usage';
import { reportError } from './errorReport';

export type ShareOutcome = 'sent' | 'cancelled' | 'failed';

/** A picture's address turned into inline data, with its image type (WhatsApp rejects a share that does not name the type). */
async function toDataUri(url: string): Promise<{ data: string; type: string }> {
  const res = await fetch(url);
  const blob = await res.blob();
  // The blob's own type is often empty on the phone, and FileReader then labels it application/octet-stream,
  // which the share saves as a .bin file. So the type comes from the server's content-type, not from the blob.
  const served = /^image\/[a-z+.-]+$/i.exec(String(res.headers?.get('content-type') ?? '').split(';')[0].trim())?.[0];
  const type = served ?? 'image/jpeg';
  const b64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(blob);
  });
  return { data: `data:${type};base64,${b64}`, type };
}

/**
 * Sends up to 10 of a unit's pictures (with optional text) through the phone's share sheet (WhatsApp or any app).
 * Logs the outcome under `event`: ok is false only when the share failed, and `stage` says where it failed.
 */
export async function sharePhotos(
  urls: string[],
  message: string,
  event: UsageEvent,
  meta: Record<string, string | number | boolean> = {},
): Promise<ShareOutcome> {
  const t0 = Date.now();
  let stage: 'download' | 'share' = 'download';
  let outcome: ShareOutcome;
  try {
    const files = await Promise.all(urls.slice(0, 10).map(toDataUri));
    stage = 'share';
    const res = await Share.open({
      urls: files.map((f) => f.data),
      type: files.length === 1 ? files[0].type : 'image/*',
      message,
      failOnCancel: false,
      // Android: the pictures must go to the app's own cache. The default (external cache) is outside the
      // library's file provider paths, so the share carried no file and WhatsApp did nothing.
      // The native side reads this option; the library's TypeScript type just does not list it.
      useInternalStorage: true,
    } as Parameters<typeof Share.open>[0]);
    outcome = res.dismissedAction ? 'cancelled' : 'sent';
  } catch (e) {
    outcome = e instanceof Error && /cancel|dismiss/i.test(e.message) ? 'cancelled' : 'failed';
    // Keep the real error (message and stack) on the server, next to the usage row that says where it failed.
    if (outcome === 'failed') reportError(e, `share_${event}_${stage}`);
  }
  const failedAt = outcome === 'failed' ? stage : undefined;
  usage(event, outcome !== 'failed', Date.now() - t0, { ...meta, pictures: urls.length, result: outcome, ...(failedAt ? { stage: failedAt } : {}) });
  return outcome;
}
