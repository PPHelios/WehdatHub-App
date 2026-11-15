import { AppState, Platform } from 'react-native';
import { API_BASE_URL, APP_VERSION } from './config';
import { useAuth } from './auth';

/**
 * Feature use and timings, sent to the server in small batches (POST /usage-events). Never a name, phone or free text:
 * only an event name, ok/failed, milliseconds and short codes. Sending is quiet and never blocks or breaks the app.
 */
export type UsageEvent = 'ask' | 'search' | 'voice_search' | 'open_unit' | 'flyer_make' | 'flyer_save' | 'flyer_share' | 'client_link' | 'call_tap' | 'whatsapp_tap' | 'lead_assign' | 'lead_paste' | 'unit_save' | 'photo_upload' | 'screen_slow';

type Item = { event: UsageEvent; ok: boolean; ms?: number; meta?: Record<string, string | number | boolean> };

let queue: Item[] = [];
const trail: string[] = [];
/** The last few things the person did (names only), sent with a report so we can see what led up to it. */
export const usageTrail = (): string[] => [...trail];
let timer: ReturnType<typeof setTimeout> | null = null;

export function usage(event: UsageEvent, ok = true, ms?: number, meta?: Item['meta']) {
  trail.push(`${event}${ok ? '' : ' (failed)'}`);
  if (trail.length > 10) trail.shift();
  queue.push({ event, ok, ms: ms === undefined ? undefined : Math.round(ms), meta: { platform: Platform.OS, app_version: APP_VERSION, ...(meta ?? {}) } });
  if (queue.length >= 20) void flushUsage();
  else if (!timer) timer = setTimeout(() => void flushUsage(), 30000);
}

/** Runs the call, records how long it took and whether it worked, and returns its result (or rethrows its error). */
export async function timed<T>(event: UsageEvent, run: () => Promise<T>, meta?: Item['meta']): Promise<T> {
  const t0 = Date.now();
  try {
    const r = await run();
    usage(event, true, Date.now() - t0, meta);
    return r;
  } catch (e) {
    usage(event, false, Date.now() - t0, meta);
    throw e;
  }
}

export async function flushUsage() {
  if (timer) clearTimeout(timer);
  timer = null;
  const token = useAuth.getState().token;
  if (!token || !queue.length) return;
  const events = queue.splice(0, 20);
  try {
    await fetch(`${API_BASE_URL}/api/v1/usage-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-App-Platform': Platform.OS, 'X-App-Version': APP_VERSION },
      body: JSON.stringify({ events })
    });
  } catch {
    // Dropped on purpose: usage numbers must never cost the user anything.
  }
}

/** Sends what is waiting when the app goes to the background. Call once at start. */
export function startUsage() {
  const sub = AppState.addEventListener('change', (s) => {
    if (s !== 'active') void flushUsage();
  });
  return () => sub.remove();
}
