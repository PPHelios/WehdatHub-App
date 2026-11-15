import { getAnalytics, logEvent, logScreenView, setAnalyticsCollectionEnabled } from '@react-native-firebase/analytics';

/** Usage events, only after Firebase has started (the server sent its identifiers). Never a name, phone or free text. */
let on = false;

export async function startAnalytics() {
  try {
    await setAnalyticsCollectionEnabled(getAnalytics(), true);
    on = true;
  } catch {
    on = false;
  }
}

export type AppEvent = 'sign_in' | 'unit_saved' | 'unit_save_refused' | 'search_run' | 'lead_created' | 'link_shared' | 'alert_opened';

/** Params are short codes or counts only (e.g. { reason: 'incomplete' }). */
export function track(name: AppEvent, params: Record<string, string | number> = {}) {
  if (!on) return;
  try {
    logEvent(getAnalytics(), name as string, params);
  } catch {
    // Analytics must never break the app.
  }
}

export function trackScreen(name: string) {
  if (!on || !name) return;
  try {
    logScreenView(getAnalytics(), { screen_name: name, screen_class: name });
  } catch {
    // Same.
  }
}
