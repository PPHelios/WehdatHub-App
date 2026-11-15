import { Platform } from 'react-native';
import { createApiClient } from '@wehdathub/shared';
import { API_BASE_URL, APP_VERSION } from './config';
import { useAuth } from './auth';

/** The one API client: sends the stored token and signs the phone out when the server ends the session. */
export const api = createApiClient({
  baseUrl: API_BASE_URL,
  headers: { 'X-App-Platform': Platform.OS, 'X-App-Version': APP_VERSION },
  getToken: () => useAuth.getState().token,
  onUnauthorized: () => {
    useAuth.getState().signOut();
  },
});
