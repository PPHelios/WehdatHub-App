import { createApiClient } from '@wehdathub/shared';
import { API_BASE_URL } from './config';
import { useAuth } from './auth';

/** The one API client: sends the stored token and signs the phone out when the server ends the session. */
export const api = createApiClient({
  baseUrl: API_BASE_URL,
  getToken: () => useAuth.getState().token,
  onUnauthorized: () => {
    useAuth.getState().signOut();
  },
});
