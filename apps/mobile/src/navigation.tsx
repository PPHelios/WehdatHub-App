import React from 'react';
import type { UploadFile } from '@wehdathub/shared';
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth, currentLang } from './auth';
import { Loading } from './components/StateViews';
import { AddUnitScreen } from './screens/AddUnitScreen';
import { LeadScreen } from './screens/LeadScreen';
import { LeadsScreen } from './screens/LeadsScreen';
import { NewLeadScreen } from './screens/NewLeadScreen';
import { MapScreen } from './screens/MapScreen';
import { LoginScreen } from './screens/LoginScreen';
import { MoreScreen } from './screens/MoreScreen';
import { UnitScreen } from './screens/UnitScreen';
import { SearchScreen } from './screens/SearchScreen';
import { TodayScreen } from './screens/TodayScreen';
import { UnitsScreen } from './screens/UnitsScreen';
import { narrow } from './layout';

const TodayNarrow = narrow(TodayScreen);
const SearchNarrow = narrow(SearchScreen);
const MoreNarrow = narrow(MoreScreen);
const UnitNarrow = narrow(UnitScreen);
const LeadNarrow = narrow(LeadScreen);
const NewLeadNarrow = narrow(NewLeadScreen);
const AddUnitNarrow = narrow(AddUnitScreen);
import { t } from './i18n';
import { useTheme } from './theme';

export type AddUnitParams = { text?: string; photos?: UploadFile[]; voice?: UploadFile };
export type RootStackParams = { Tabs: undefined; Unit: { code: string }; Lead: { ref: string }; NewLead: undefined; AddUnit: AddUnitParams | undefined };
export const navigationRef = createNavigationContainerRef<RootStackParams>();
type TabParams = { Today: undefined; Search: undefined; Leads: undefined; Map: undefined; Units: undefined; More: undefined };

const Stack = createNativeStackNavigator<RootStackParams>();
const Tabs = createBottomTabNavigator<TabParams>();

function TabsScreen() {
  const lang = currentLang();
  return (
    <Tabs.Navigator>
      <Tabs.Screen name="Today" component={TodayNarrow} options={{ title: t(lang, 'today') }} />
      <Tabs.Screen name="Search" component={SearchNarrow} options={{ title: t(lang, 'searchTab') }} />
      <Tabs.Screen name="Leads" component={LeadsScreen} options={{ title: t(lang, 'leadsTab') }} />
      <Tabs.Screen name="Map" component={MapScreen} options={{ title: t(lang, 'mapTab') }} />
      <Tabs.Screen name="Units" component={UnitsScreen} options={{ title: t(lang, 'units') }} />
      <Tabs.Screen name="More" component={MoreNarrow} options={{ title: t(lang, 'more') }} />
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
    <NavigationContainer theme={theme} ref={navigationRef}>
      {status === 'signedOut' ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={LoginScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator>
          <Stack.Screen name="Tabs" component={TabsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Unit" component={UnitNarrow} options={{ title: t(currentLang(), 'unit') }} />
          <Stack.Screen name="Lead" component={LeadNarrow} options={{ title: t(currentLang(), 'leadsTab') }} />
          <Stack.Screen name="NewLead" component={NewLeadNarrow} options={{ title: t(currentLang(), 'newLead') }} />
          <Stack.Screen name="AddUnit" component={AddUnitNarrow} options={{ title: t(currentLang(), 'addUnit') }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
