import Share from 'react-native-share';
import { usage, UsageEvent } from './usage';

export type ShareOutcome = 'sent' | 'cancelled' | 'failed';

/** A picture's address turned into inline data, with its image type (WhatsApp rejects a share that does not name the type). */
async function toDataUri(url: string): Promise<{ data: string; type: string }> {
  const blob = await (await fetch(url)).blob();
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(blob);
  });
  const type = /^data:(image\/[a-z+.-]+);/i.exec(data)?.[1] ?? 'image/jpeg';
  return { data, type };
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
  }
  const failedAt = outcome === 'failed' ? stage : undefined;
  usage(event, outcome !== 'failed', Date.now() - t0, { ...meta, pictures: urls.length, result: outcome, ...(failedAt ? { stage: failedAt } : {}) });
  return outcome;
}
