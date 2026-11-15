import { I18nManager } from 'react-native';
import type { Lang } from '@wehdathub/shared';

/** Arabic reads right to left; English left to right. */
export const wantsRtl = (lang: Lang): boolean => lang === 'ar';

/**
 * Makes the layout direction match the app language. The phone keeps the setting, and a change only shows after the app is
 * closed and opened again, so this returns true when that is needed (the caller then tells the person).
 */
export function syncDirection(lang: Lang): boolean {
  const rtl = wantsRtl(lang);
  if (I18nManager.isRTL === rtl) return false;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return true;
}
