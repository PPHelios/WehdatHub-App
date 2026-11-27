import AsyncStorage from '@react-native-async-storage/async-storage';
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

export type AppEvent = 'sign_in' | 'sign_in_failed' | 'unit_saved' | 'unit_save_refused' | 'search_started' | 'search_run' | 'lead_created' | 'link_shared' | 'search_unit_opened' | 'unit_save_started' | 'lead_save_started' | 'feature_used' | 'home_priority_tapped' | 'home_tip_tapped' | 'home_tip_dismissed' | 'assistant_query_run' | 'assistant_action_tapped' | 'lead_nudge_sent' | 'voice_transcript_outcome' | 'signup_started' | 'signup_submitted' | 'signup_verified' | 'starter_step_done' | 'practice_started' | 'practice_completed' | 'practice_skipped' | 'first_question' | 'suggestion_tapped' | 'clarify_shown' | 'welcome_completed';

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

/** Fires first_question once per broker (a stored flag), on their first assistant or search query. */
export async function trackFirstQuestion(brokerId?: string) {
  if (!brokerId) return;
  const key = `wehdathub.firstQuestion:${brokerId}`;
  try {
    if (await AsyncStorage.getItem(key)) return;
    await AsyncStorage.setItem(key, '1');
    void track('first_question');
  } catch {
    // Storage unreadable: skip rather than count it twice.
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
