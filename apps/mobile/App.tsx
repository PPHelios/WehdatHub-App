import React, { useEffect, useState } from 'react';
import { startUsage, usage } from './src/usage';
import { Alert, AppState, I18nManager, StatusBar, useColorScheme } from 'react-native';
import { BusyProvider } from './src/busy';
import { ToastHost, toast } from './src/components/Toast';
import { KeyboardLift } from './src/components/KeyboardLift';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, focusManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DAY, KEPT, listsStore } from './src/lists';
import { OfflineBanner } from './src/offline';
import { PlanBlockedGate } from './src/components/PlanBlockedGate';
import { PlanLockSheet } from './src/components/PlanLockSheet';
import { isOutdated } from '@wehdathub/shared';
import type { AppConfig } from '@wehdathub/shared';
import { configOptions, meOptions } from './src/queries';
import { api } from './src/api';
import { useAuth } from './src/auth';
import { LockScreen } from './src/components/LockScreen';
import { UpdateScreen } from './src/components/UpdateScreen';
import { APP_VERSION } from './src/config';
import { LOCK_AFTER_MS, useLock } from './src/lock';
import { clearPlaces, usePlaceSync } from './src/placeList';
import { RootNavigation, navigationRef } from './src/navigation';
import { startAnalytics } from './src/analytics';
import { installErrorReporting } from './src/errorReport';
import { startCrashReports, startFirebase, startPush } from './src/push';
import { watchShares } from './src/share';
import { syncDirection } from './src/direction';
import { usePrefs } from './src/prefs';
import { t } from './src/i18n';

I18nManager.allowRTL(true);

const queries = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000, gcTime: DAY } } });

// Tell TanStack when the app is in the foreground (refetch on focus).
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (st) => handleFocus(st === 'active'));
  return () => sub.remove();
});

export default function App() {
  useEffect(() => installErrorReporting(), []);
  useEffect(() => startUsage(), []);
  const restore = useAuth((s) => s.restore);
  const status = useAuth((s) => s.status);
  const locked = useLock((s) => s.locked);
  const systemScheme = useColorScheme();
  const appearance = usePrefs((s) => s.appearance);
  const scheme = appearance === 'system' ? systemScheme : appearance;
  const [tooOld, setTooOld] = useState<AppConfig | null>(null);

  useEffect(() => {
    restore();
    useLock.getState().load();
    void usePrefs.getState().load();
    // The server says the lowest app version it supports. A failure to ask never blocks the app.
    queries.fetchQuery(configOptions).then((c) => isOutdated(APP_VERSION, c.minAppVersion) && setTooOld(c)).catch(() => undefined);
  }, [restore]);

  // The layout direction follows the app language; a change only shows after the app is reopened.
  const lang = useAuth((s) => s.broker?.lang);
  useEffect(() => {
    if (status === 'signedIn' && lang && syncDirection(lang)) Alert.alert(t(lang, 'restartForLayout'));
  }, [status, lang]);

  // Lock after 30 seconds in the background.
  useEffect(() => {
    let left: number | null = null;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background' || st === 'inactive') left = left ?? Date.now();
      else {
        if (left !== null && Date.now() - left > LOCK_AFTER_MS) useLock.getState().lock();
        left = null;
      }
    });
    return () => sub.remove();
  }, []);

  // Something shared in from another app (WhatsApp photos, a voice note, text) opens Add unit with it.
  useEffect(() => {
    if (status !== 'signedIn') return;
    return watchShares((s) => {
      // A WhatsApp chat export (a zip) opens the import screen; everything else opens Add unit.
      if (s.zip) usage('wa_import_share', true);
      const go = () => (s.zip ? navigationRef.navigate('WhatsAppImport', { zip: s.zip }) : navigationRef.navigate('AddUnit', s));
      const open = (fn: () => void) => (navigationRef.isReady() ? fn() : void setTimeout(fn, 800));
      // Text only, shared by a manager or the owner: a portal enquiry (Bayut, Dubizzle, Nawy) opens its own screen.
      const rights = queries.getQueryData(meOptions().queryKey)?.rights;
      const text = s.text;
      if (text && !s.zip && !s.photos?.length && !s.voice && (rights?.manager || rights?.agencyOwner)) {
        api.readPortalEnquiry(text)
          .then((r) => open(() => navigationRef.navigate('PortalEnquiry', { message: text, enquiry: { portal: r.portal, name: r.name, link: r.link, listingNo: r.listingNo } })))
          .catch(() => open(go));
        return;
      }
      open(go);
    });
  }, [status]);

  // The place list is kept on the phone: checked on sign-in, when the app comes back, and cleared on sign-out.
  useEffect(() => {
    if (status === 'signedOut') {
      clearPlaces().catch(() => undefined);
      // The session ended (e.g. a 401): drop the last person's cached data, as the manual logout does.
      queries.clear();
      void listsStore.removeClient();
      return;
    }
  }, [status]);
  usePlaceSync(status === 'signedIn');

  // Crash reporting and Analytics can start before sign-in. Push needs a signed-in broker.
  useEffect(() => {
    if (status === 'loading') return;
    let stop = () => undefined as void;
    let gone = false;
    queries
      .fetchQuery(configOptions)
      .then(async (c) => {
        if (gone || !(await startFirebase(c.firebase)) || gone) return;
        void startCrashReports();
        void startAnalytics();
        if (status !== 'signedIn') return;
        const off = await startPush((s) => {
          const go = () => navigationRef.navigate(s.name, s.params as never);
          if (navigationRef.isReady()) go();
          else setTimeout(go, 800);
        }, async (text, s) => {
          if (gone) return;
          toast(text);
          const keys = [['inbox'], ['leads'], ['units'], ['today']];
          if (s?.name === 'Lead') keys.push(['lead', s.params.ref]);
          if (s?.name === 'Unit') keys.push(['unit', s.params.code]);
          await Promise.all(keys.map((queryKey) => queries.invalidateQueries({ queryKey })));
        });
        if (gone) off();
        else stop = off;
      })
      .catch(() => undefined);
    return () => {
      gone = true;
      stop();
    };
  }, [status]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      {tooOld ? (
        <UpdateScreen config={tooOld} />
      ) : (
        <PersistQueryClientProvider client={queries} persistOptions={{ persister: listsStore, maxAge: DAY, buster: 'v2', dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && KEPT.includes(String(q.queryKey[0])) } }}>
          <BusyProvider>
            <KeyboardLift>
              <RootNavigation />
            </KeyboardLift>
          </BusyProvider>
          {locked && status === 'signedIn' ? <LockScreen /> : null}
          <PlanBlockedGate />
          <PlanLockSheet onOpenPlan={() => navigationRef.isReady() && navigationRef.navigate('Plan')} />
          <OfflineBanner />
          <ToastHost />
        </PersistQueryClientProvider>
      )}
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
