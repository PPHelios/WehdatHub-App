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

export type AppEvent = 'sign_in' | 'sign_in_failed' | 'unit_saved' | 'unit_save_refused' | 'search_started' | 'search_run' | 'lead_created' | 'link_shared' | 'search_unit_opened' | 'unit_save_started' | 'lead_save_started' | 'feature_used' | 'home_priority_tapped' | 'home_tip_tapped' | 'home_tip_dismissed' | 'assistant_query_run' | 'assistant_action_tapped' | 'lead_nudge_sent' | 'voice_transcript_outcome';

/** Params are short codes or counts only (e.g. { reason: 'incomplete' }). */
export async function track(name: AppEvent, params: Record<string, string | number> = {}) {
  if (!on) return false;
  try {
    await logEvent(getAnalytics(), name, { ...params, surface: 'app' });
    return true;
  } catch {
    return false;
  }
}

export function trackScreen(name: string) {
  if (!on || !name) return;
  try {
    void logScreenView(getAnalytics(), { screen_name: name, screen_class: name }).catch(() => undefined);
  } catch {
    // Same.
  }
}
