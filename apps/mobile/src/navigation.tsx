import React from 'react';
import { Text } from 'react-native';
import type { UploadFile } from '@wehdathub/shared';
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth, currentLang } from './auth';
import { Loading } from './components/StateViews';
import { AddUnitScreen } from './screens/AddUnitScreen';
import { LeadScreen } from './screens/LeadScreen';
import { LeadsScreen } from './screens/LeadsScreen';
import { NewLeadScreen } from './screens/NewLeadScreen';
import { MapScreen } from './screens/MapScreen';
import { LoginScreen } from './screens/LoginScreen';
import { MoreScreen } from './screens/MoreScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { SentLinksScreen } from './screens/SentLinksScreen';
import { TeamMemberScreen, TeamScreen } from './screens/TeamScreen';
import { AskScreen } from './screens/AskScreen';
import { UnitScreen } from './screens/UnitScreen';
import { SearchScreen } from './screens/SearchScreen';
import { TodayScreen } from './screens/TodayScreen';
import { UnitsScreen } from './screens/UnitsScreen';
import { ContactsScreen } from './screens/ContactsScreen';
import { narrow } from './layout';
import { useRights } from './rights';

const TodayNarrow = narrow(TodayScreen);
const SearchNarrow = narrow(SearchScreen);
function MoreTab() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  return <MoreScreen onOpen={(s) => nav.navigate(s)} />;
}
const MoreNarrow = narrow(MoreTab);
const CalendarNarrow = narrow(CalendarScreen);
const SentLinksNarrow = narrow(SentLinksScreen);
const TeamNarrow = narrow(TeamScreen);
const TeamMemberNarrow = narrow(TeamMemberScreen);
const AskNarrow = narrow(AskScreen);
const UnitNarrow = narrow(UnitScreen);
const LeadNarrow = narrow(LeadScreen);
const NewLeadNarrow = narrow(NewLeadScreen);
const AddUnitNarrow = narrow(AddUnitScreen);
import { t } from './i18n';
import { useTheme } from './theme';

export type AddUnitParams = { text?: string; photos?: UploadFile[]; voice?: UploadFile; /** Code of the unit to edit; the screen then edits instead of adding. */ edit?: string };
export type RootStackParams = { Tabs: undefined; Unit: { code: string }; Lead: { ref: string }; NewLead: { name?: string; phone?: string } | undefined; Contacts: undefined; Calendar: undefined; SentLinks: undefined; Team: undefined; TeamMember: { id: string; name: string }; Ask: undefined; AddUnit: AddUnitParams | undefined };
export const navigationRef = createNavigationContainerRef<RootStackParams>();
type TabParams = { Today: undefined; Search: undefined; Leads: undefined; Map: undefined; Units: undefined; More: undefined };

const Stack = createNativeStackNavigator<RootStackParams>();
const Tabs = createBottomTabNavigator<TabParams>();

/** Tab bar glyphs: a plain text symbol per tab (a stopgap until the icon set lands with the design pass). */
function tabIcon(glyph: string) {
  return ({ color }: { color: string }) => <Text style={{ color, fontSize: 20, lineHeight: 24 }}>{glyph}</Text>;
}

function TabsScreen() {
  const lang = currentLang();
  const rights = useRights();
  return (
    <Tabs.Navigator>
      {rights.leads ? <Tabs.Screen name="Today" component={TodayNarrow} options={{ title: t(lang, 'today'), tabBarIcon: tabIcon('⌂') }} /> : null}
      {rights.search ? <Tabs.Screen name="Search" component={SearchNarrow} options={{ title: t(lang, 'searchTab'), tabBarIcon: tabIcon('⌕') }} /> : null}
      {rights.leads ? <Tabs.Screen name="Leads" component={LeadsScreen} options={{ title: t(lang, 'leadsTab'), tabBarIcon: tabIcon('◉') }} /> : null}
      <Tabs.Screen name="Map" component={MapScreen} options={{ title: t(lang, 'mapTab'), tabBarIcon: tabIcon('◎') }} />
      <Tabs.Screen name="Units" component={UnitsScreen} options={{ title: t(lang, 'units'), tabBarIcon: tabIcon('▤') }} />
      <Tabs.Screen name="More" component={MoreNarrow} options={{ title: t(lang, 'more'), tabBarIcon: tabIcon('≡') }} />
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
          <Stack.Screen name="Contacts" component={ContactsScreen} options={{ title: t(currentLang(), 'fromContacts') }} />
          <Stack.Screen name="NewLead" component={NewLeadNarrow} options={{ title: t(currentLang(), 'newLead') }} />
          <Stack.Screen name="Calendar" component={CalendarNarrow} options={{ title: t(currentLang(), 'calendar') }} />
          <Stack.Screen name="SentLinks" component={SentLinksNarrow} options={{ title: t(currentLang(), 'sentLinks') }} />
          <Stack.Screen name="Team" component={TeamNarrow} options={{ title: t(currentLang(), 'team') }} />
          <Stack.Screen name="TeamMember" component={TeamMemberNarrow} options={({ route }) => ({ title: route.params.name })} />
          <Stack.Screen name="Ask" component={AskNarrow} options={{ title: t(currentLang(), 'ask') }} />
          <Stack.Screen name="AddUnit" component={AddUnitNarrow} options={{ title: t(currentLang(), 'addUnit') }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
