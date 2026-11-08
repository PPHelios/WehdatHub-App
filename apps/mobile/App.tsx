import React, { useEffect } from 'react';
import { I18nManager, StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './src/auth';
import { RootNavigation } from './src/navigation';

I18nManager.allowRTL(true);

const queries = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

export default function App() {
  const restore = useAuth((s) => s.restore);
  const scheme = useColorScheme();
  useEffect(() => {
    restore();
  }, [restore]);
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <QueryClientProvider client={queries}>
        <RootNavigation />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
