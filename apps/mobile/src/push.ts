import { PermissionsAndroid, Platform } from 'react-native';
import { getApps, initializeApp } from '@react-native-firebase/app';
import { getCrashlytics, recordError, setCrashlyticsCollectionEnabled, setUserId } from '@react-native-firebase/crashlytics';
import { getInitialNotification, getMessaging, getToken, onMessage, onNotificationOpenedApp, onTokenRefresh, requestPermission } from '@react-native-firebase/messaging';
import type { AppConfig } from '@wehdathub/shared';
import { api } from './api';

export type Screen = { name: 'Lead'; params: { ref: string } } | { name: 'Unit'; params: { code: string } };

/** The screen an alert opens, from the address the server puts in it (a lead ref or a unit code). */
export function screenFor(url: unknown): Screen | null {
  const s = typeof url === 'string' ? url : '';
  const lead = /\/leads?\/(L-\d{3,})/i.exec(s);
  if (lead) return { name: 'Lead', params: { ref: lead[1].toUpperCase() } };
  const unit = /\/units?\/([A-Za-z0-9][A-Za-z0-9-]{0,39})(?:[/?#]|$)/.exec(s);
  if (unit) return { name: 'Unit', params: { code: unit[1] } };
  return null;
}

let current: string | null = null;

/** Starts Firebase from the identifiers the server sends. Returns false when they are missing, so everything stays off. */
export async function startFirebase(cfg: AppConfig['firebase']): Promise<boolean> {
  try {
    const mine = cfg?.[Platform.OS === 'ios' ? 'ios' : 'android'];
    if (!mine) return false;
    if (!getApps().length) await initializeApp(mine);
    return true;
  } catch {
    return false;
  }
}

/** Crash reports on, tagged with the broker's id only (never a name or a number). */
export async function startCrashReports(brokerId: string) {
  try {
    const c = getCrashlytics();
    await setCrashlyticsCollectionEnabled(c, true);
    await setUserId(c, brokerId);
    const previous = (globalThis as { ErrorUtils?: { getGlobalHandler(): (e: Error, fatal?: boolean) => void; setGlobalHandler(h: (e: Error, fatal?: boolean) => void): void } }).ErrorUtils;
    if (previous) {
      const old = previous.getGlobalHandler();
      previous.setGlobalHandler((e, fatal) => {
        try {
          recordError(c, e);
        } catch {
          // Reporting must never break the app.
        }
        old(e, fatal);
      });
    }
  } catch {
    // Crash reports are optional.
  }
}

async function allowed(): Promise<boolean> {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const r = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never);
    return r === PermissionsAndroid.RESULTS.GRANTED;
  }
  const status = await requestPermission(getMessaging());
  return status === 1 || status === 2; // authorized or provisional
}

/** Asks for permission, saves this phone's token on the server, keeps it fresh and opens the screen an alert points to. */
export async function startPush(open: (s: Screen) => void): Promise<() => void> {
  const stops: Array<() => void> = [];
  try {
    if (!(await allowed())) return () => undefined;
    const m = getMessaging();
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const save = async (t: string) => {
      current = t;
      await api.registerDevice(t, platform).catch(() => undefined);
    };
    await save(await getToken(m));
    stops.push(onTokenRefresh(m, (t) => { save(t).catch(() => undefined); }));
    stops.push(onMessage(m, () => undefined));
    stops.push(onNotificationOpenedApp(m, (msg) => { const s = screenFor(msg.data?.url); if (s) open(s); }));
    const first = await getInitialNotification(m);
    const s = screenFor(first?.data?.url);
    if (s) open(s);
  } catch {
    // Alerts are optional: a failure here never blocks the app.
  }
  return () => stops.forEach((f) => f());
}

/** On sign-out: this phone stops getting this broker's alerts. */
export async function stopPush() {
  const t = current;
  current = null;
  if (t) await api.removeDevice(t).catch(() => undefined);
}
