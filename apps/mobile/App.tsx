import React, { useEffect, useState } from 'react';
import { AppState, I18nManager, StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isOutdated } from '@wehdathub/shared';
import type { AppConfig } from '@wehdathub/shared';
import { api } from './src/api';
import { useAuth } from './src/auth';
import { LockScreen } from './src/components/LockScreen';
import { UpdateScreen } from './src/components/UpdateScreen';
import { APP_VERSION } from './src/config';
import { LOCK_AFTER_MS, useLock } from './src/lock';
import { RootNavigation, navigationRef } from './src/navigation';
import { watchShares } from './src/share';

I18nManager.allowRTL(true);

const queries = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

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

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      {tooOld ? (
        <UpdateScreen config={tooOld} />
      ) : (
        <QueryClientProvider client={queries}>
          <RootNavigation />
          {locked && status === 'signedIn' ? <LockScreen /> : null}
        </QueryClientProvider>
      )}
    </SafeAreaProvider>
  );
}
