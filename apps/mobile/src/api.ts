import { Platform } from 'react-native';
import { createApiClient } from '@wehdathub/shared';
import { API_BASE_URL, APP_VERSION } from './config';
import { useAuth } from './auth';
import { BACKGROUND_WRITE, beginBusy } from './busy';
import { usePlanLock } from './planLock';

/** The one API client: sends the stored token and signs the phone out when the server ends the session. */
export const api = createApiClient({
  baseUrl: API_BASE_URL,
  headers: { 'X-App-Platform': Platform.OS, 'X-App-Version': APP_VERSION },
  getToken: () => useAuth.getState().token,
  // The busy rule: a write locks the screen until it ends (the app's own background writes do not).
  onWrite: (_method, path) => (BACKGROUND_WRITE.test(path) ? undefined : beginBusy()),
  // The plan guard said 402: the pay / ask-your-manager sheet opens (no raw error text).
  onPlanLocked: (e) => usePlanLock.getState().show(e),
  onUnauthorized: () => {
    useAuth.getState().signOut();
  },
});
