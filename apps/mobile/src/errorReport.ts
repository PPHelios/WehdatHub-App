import { Platform } from 'react-native';
import { api } from './api';
import { APP_VERSION } from './config';

let last = '';

/** Tells the server about a crash or an unhandled error (rate-limited there). Never throws; only the message and stack go, no user data. */
export function reportError(e: unknown, where: string) {
  try {
    const err = e instanceof Error ? e : new Error(String(e));
    const key = `${where}:${err.message}`;
    if (key === last) return;
    last = key;
    api.reportClientError({ message: err.message.slice(0, 500), stack: String(err.stack || '').slice(0, 4000), screen: where, platform: Platform.OS, appVersion: APP_VERSION }).catch(() => undefined);
  } catch {
    // Reporting must never break the app.
  }
}

/** Unhandled JS errors and promise rejections go to the server, then the previous handler runs. */
export function installErrorReporting() {
  const eu = (globalThis as { ErrorUtils?: { getGlobalHandler(): (e: Error, fatal?: boolean) => void; setGlobalHandler(h: (e: Error, fatal?: boolean) => void): void } }).ErrorUtils;
  if (!eu) return;
  const old = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => {
    reportError(e, fatal ? 'fatal' : 'js');
    old(e, fatal);
  });
}
