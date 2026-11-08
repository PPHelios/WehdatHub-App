import React from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth, currentLang } from './auth';
import { Loading } from './components/StateViews';
import { LoginScreen } from './screens/LoginScreen';
import { MoreScreen } from './screens/MoreScreen';
import { UnitScreen } from './screens/UnitScreen';
import { TodayScreen } from './screens/TodayScreen';
import { UnitsScreen } from './screens/UnitsScreen';
import { t } from './i18n';
import { useTheme } from './theme';

export type RootStackParams = { Tabs: undefined; Unit: { code: string } };
type TabParams = { Today: undefined; Units: undefined; More: undefined };

const Stack = createNativeStackNavigator<RootStackParams>();
const Tabs = createBottomTabNavigator<TabParams>();

function TabsScreen() {
  const lang = currentLang();
  return (
    <Tabs.Navigator>
      <Tabs.Screen name="Today" component={TodayScreen} options={{ title: t(lang, 'today') }} />
      <Tabs.Screen name="Units" component={UnitsScreen} options={{ title: t(lang, 'units') }} />
      <Tabs.Screen name="More" component={MoreScreen} options={{ title: t(lang, 'more') }} />
    </Tabs.Navigator>
  );
}

export function RootNavigation() {
  const status = useAuth((s) => s.status);
  const { colors, scheme } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, primary: colors.primary, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border } };
  if (status === 'loading') return <Loading />;
  return (
    <NavigationContainer theme={theme}>
      {status === 'signedOut' ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={LoginScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator>
          <Stack.Screen name="Tabs" component={TabsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Unit" component={UnitScreen} options={{ title: t(currentLang(), 'unit') }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
