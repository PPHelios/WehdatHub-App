import React, { useEffect, useState } from 'react';
import { AppState, I18nManager, StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DAY, KEPT, listsStore } from './src/lists';
import { OfflineBanner } from './src/offline';
import { isOutdated } from '@wehdathub/shared';
import type { AppConfig } from '@wehdathub/shared';
import { api } from './src/api';
import { useAuth } from './src/auth';
import { LockScreen } from './src/components/LockScreen';
import { UpdateScreen } from './src/components/UpdateScreen';
import { APP_VERSION } from './src/config';
import { LOCK_AFTER_MS, useLock } from './src/lock';
import { clearPlaces, syncPlaces } from './src/placeList';
import { RootNavigation, navigationRef } from './src/navigation';
import { startCrashReports, startFirebase, startPush } from './src/push';
import { watchShares } from './src/share';

I18nManager.allowRTL(true);

const queries = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000, gcTime: DAY } } });

export default function App() {
  const restore = useAuth((s) => s.restore);
  const status = useAuth((s) => s.status);
  const locked = useLock((s) => s.locked);
  const scheme = useColorScheme();
  const [tooOld, setTooOld] = useState<AppConfig | null>(null);

  useEffect(() => {
    restore();
    useLock.getState().load();
    // The server says the lowest app version it supports. A failure to ask never blocks the app.
    api.config().then((c) => isOutdated(APP_VERSION, c.minAppVersion) && setTooOld(c)).catch(() => undefined);
  }, [restore]);

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
      const go = () => navigationRef.navigate('AddUnit', s);
      if (navigationRef.isReady()) go();
      else setTimeout(go, 800);
    });
  }, [status]);

  // The place list is kept on the phone: checked on sign-in, when the app comes back, and cleared on sign-out.
  useEffect(() => {
    if (status === 'signedOut') {
      clearPlaces().catch(() => undefined);
      return;
    }
    if (status !== 'signedIn') return;
    syncPlaces().catch(() => undefined);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') syncPlaces().catch(() => undefined);
    });
    return () => sub.remove();
  }, [status]);

  // Alerts and crash reports start once signed in, if the server has the phone's Firebase identifiers.
  useEffect(() => {
    if (status !== 'signedIn') return;
    let stop = () => undefined as void;
    let gone = false;
    api
      .config()
      .then(async (c) => {
        if (gone || !(await startFirebase(c.firebase))) return;
        const id = useAuth.getState().broker?.id;
        if (id) startCrashReports(String(id)).catch(() => undefined);
        const off = await startPush((s) => {
          const go = () => navigationRef.navigate(s.name, s.params as never);
          if (navigationRef.isReady()) go();
          else setTimeout(go, 800);
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
    <SafeAreaProvider>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      {tooOld ? (
        <UpdateScreen config={tooOld} />
      ) : (
        <PersistQueryClientProvider client={queries} persistOptions={{ persister: listsStore, maxAge: DAY, buster: 'v1', dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && KEPT.includes(String(q.queryKey[0])) } }}>
          <RootNavigation />
          {locked && status === 'signedIn' ? <LockScreen /> : null}
          <OfflineBanner />
        </PersistQueryClientProvider>
      )}
    </SafeAreaProvider>
  );
}
