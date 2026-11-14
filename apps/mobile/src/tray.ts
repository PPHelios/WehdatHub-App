import notifee from '@notifee/react-native';

/** Closes the notifications still shown on the phone and clears the number on the app icon (when nothing is unread). */
export async function clearTray(): Promise<void> {
  try {
    await notifee.cancelAllNotifications();
    await notifee.setBadgeCount(0);
  } catch {
    /* the phone refused or the module is missing: the inbox itself is unaffected */
  }
}
