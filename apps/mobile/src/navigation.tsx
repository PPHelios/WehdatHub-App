import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { LeadTab, UploadFile } from '@wehdathub/shared';
import { trackScreen } from './analytics';
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth, currentLang } from './auth';
import { BottomSafe } from './components/BottomSafe';
import { Icon } from './components/Icon';
import type { IconName } from './components/Icon';
import { Logo } from './components/Logo';
import { FONT_BOLD } from './fonts';
import { AddUnitScreen } from './screens/AddUnitScreen';
import { LeadScreen } from './screens/LeadScreen';
import { LeadsScreen } from './screens/LeadsScreen';
import { NewLeadScreen } from './screens/NewLeadScreen';
import { MapScreen } from './screens/MapScreen';
import { LoginScreen } from './screens/LoginScreen';
import { MoreScreen } from './screens/MoreScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { SentLinksScreen } from './screens/SentLinksScreen';
import { SavedSearchesScreen } from './screens/SavedSearchesScreen';
import { LeasesScreen } from './screens/LeasesScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { InboxScreen } from './screens/InboxScreen';
import { ClientRequestsScreen } from './screens/ClientRequestsScreen';
import { TeamMemberScreen, TeamScreen } from './screens/TeamScreen';
import { OwnerScreen, OwnersScreen } from './screens/OwnersScreen';
import { ActivityLogScreen, RequestsScreen } from './screens/RequestsScreen';
import { InviteScreen } from './screens/InviteScreen';
import { LeadRulesScreen } from './screens/LeadRulesScreen';
import { PipelineScreen } from './screens/PipelineScreen';
import { CompareScreen, LibraryScreen, PlanScreen, PlatformScreen, ProjectScreen, ProjectsScreen, UsageScreen } from './screens/MoreScreens';
import { CommissionsScreen, DealsScreen, LinksScreen, PortalScreen, SourcesScreen } from './screens/DealsScreens';
import { DashboardScreen, PricesScreen, ReportScreen, WinLossScreen } from './screens/InsightsScreens';
import { AskScreen } from './screens/AskScreen';
import { UnitScreen } from './screens/UnitScreen';
import { SearchScreen } from './screens/SearchScreen';
import { TodayScreen } from './screens/TodayScreen';
import { UnitsScreen } from './screens/UnitsScreen';
import { ContactsScreen } from './screens/ContactsScreen';
import { narrow } from './layout';
import { useRightsState } from './rights';
import { TAB_ICON, TAB_TITLE, navPlan } from './roleNav';
import type { TabKey } from './roleNav';

const TodayNarrow = narrow(TodayScreen);
const SearchNarrow = narrow(SearchScreen);
function MoreTab() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  return <MoreScreen onOpen={(s) => nav.navigate(s as never)} />;
}
const MoreNarrow = narrow(MoreTab);
const CalendarNarrow = narrow(CalendarScreen);
const SentLinksNarrow = narrow(SentLinksScreen);
const NotificationsNarrow = narrow(NotificationsScreen);
const InboxNarrow = narrow(InboxScreen);
const ClientRequestsNarrow = narrow(ClientRequestsScreen);
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
export type RootStackParams = { Tabs: undefined; Unit: { code: string; lease?: { tenantName: string; startDate: string; rent: string } }; Leases: undefined; SavedSearches: undefined; Lead: { ref: string }; NewLead: { name?: string; phone?: string } | undefined; Contacts: undefined; Calendar: undefined; SentLinks: undefined; Notifications: undefined; Inbox: undefined; ClientRequests: undefined; Team: undefined; Owners: undefined; Owner: { id: string; name: string }; Requests: undefined; ActivityLog: undefined; Invite: undefined; LeadRules: undefined; Dashboard: undefined; Deals: undefined; Projects: undefined; Project: { id: string; name: string }; Library: undefined; Compare: undefined; Plan: undefined; Usage: undefined; Platform: undefined; Commissions: undefined; Sources: undefined; Portal: undefined; Links: undefined; Prices: undefined; WinLoss: undefined; Report: undefined; UnitsList: { old?: boolean } | undefined; LeadsList: { tab?: LeadTab; broker?: string } | undefined; Pipeline: undefined; MapList: undefined; TodayList: undefined; TeamMember: { id: string; name: string; role?: string }; Ask: undefined; AddUnit: AddUnitParams | undefined };
export const navigationRef = createNavigationContainerRef<RootStackParams>();
type TabParams = Record<TabKey, undefined>;

const Stack = createNativeStackNavigator<RootStackParams>();
const Tabs = createBottomTabNavigator<TabParams>();

/** Tab bar icon: the line icon, with a soft brand-colour pill behind the active tab. */
function TabIcon({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? `${colors.primary}26` : 'transparent' }}>
      <Icon name={name} color={color} size={22} />
    </View>
  );
}
const tabIcon = (name: IconName) => ({ color, focused }: { color: string; focused: boolean }) => <TabIcon name={name} color={color} focused={focused} />;

/** Add unit on the tab bar is a button, not a screen: pressing it opens the form on top of the tabs. */
const NothingHere = () => null;

function TabsScreen() {
  const lang = currentLang();
  const { rights, ready } = useRightsState();
  const { colors } = useTheme();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const plan = navPlan(rights);
  const screens: Record<TabKey, React.ComponentType> = { Today: TodayNarrow, Search: SearchNarrow, Leads: LeadsScreen, Map: MapScreen, Units: UnitsScreen, More: MoreNarrow, Team: TeamNarrow, Dashboard: DashboardScreen, Owners: OwnersScreen, AddUnit: NothingHere, Plan: PlanScreen };
  return (
    <Tabs.Navigator
      initialRouteName={plan.initial}
      screenOptions={{
        headerTitleAlign: 'center',
        headerLeft: () => <View style={{ paddingHorizontal: 12 }}><Logo size={0.55} compact /></View>,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text, fontFamily: FONT_BOLD },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontFamily: FONT_BOLD },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, height: 64 },
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      {plan.tabs.map((k) => (
        <Tabs.Screen
          key={k}
          name={k}
          component={screens[k]}
          options={{ title: t(lang, TAB_TITLE[k]), tabBarIcon: tabIcon(TAB_ICON[k]) }}
          listeners={k === 'AddUnit' ? { tabPress: (e) => { e.preventDefault(); navigationRef.navigate('AddUnit'); } } : undefined}
        />
      ))}
    </Tabs.Navigator>
  );
}

export function RootNavigation() {
  const status = useAuth((s) => s.status);
  const { colors, scheme } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, primary: colors.primary, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border } };
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 32 }}>
        <Logo />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return (
    <NavigationContainer theme={theme} ref={navigationRef} onStateChange={() => trackScreen(navigationRef.getCurrentRoute()?.name ?? '')}>
      {status === 'signedOut' ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={LoginScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenLayout={({ children }) => <BottomSafe>{children}</BottomSafe>} screenOptions={{ headerTitleStyle: { fontFamily: FONT_BOLD }, headerTintColor: colors.text, headerShadowVisible: false }}>
          <Stack.Screen name="Tabs" component={TabsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Unit" component={UnitNarrow} options={{ title: t(currentLang(), 'unit') }} />
          <Stack.Screen name="Lead" component={LeadNarrow} options={{ title: t(currentLang(), 'leadsTab') }} />
          <Stack.Screen name="Contacts" component={ContactsScreen} options={{ title: t(currentLang(), 'fromContacts') }} />
          <Stack.Screen name="NewLead" component={NewLeadNarrow} options={{ title: t(currentLang(), 'newLead') }} />
          <Stack.Screen name="Calendar" component={CalendarNarrow} options={{ title: t(currentLang(), 'calendar') }} />
          <Stack.Screen name="SentLinks" component={SentLinksNarrow} options={{ title: t(currentLang(), 'sentLinks') }} />
          <Stack.Screen name="ClientRequests" component={ClientRequestsNarrow} options={{ title: t(currentLang(), 'clientRequests') }} />
          <Stack.Screen name="Inbox" component={InboxNarrow} options={{ title: t(currentLang(), 'inbox') }} />
          <Stack.Screen name="Notifications" component={NotificationsNarrow} options={{ title: t(currentLang(), 'notifications') }} />
          <Stack.Screen name="Team" component={TeamNarrow} options={{ title: t(currentLang(), 'team') }} />
          <Stack.Screen name="TeamMember" component={TeamMemberNarrow} options={({ route }) => ({ title: route.params.name })} />
          <Stack.Screen name="Owners" component={OwnersScreen} options={{ title: t(currentLang(), 'owners') }} />
          <Stack.Screen name="Owner" component={OwnerScreen} options={({ route }) => ({ title: route.params.name })} />
          <Stack.Screen name="Requests" component={RequestsScreen} options={{ title: t(currentLang(), 'requests') }} />
          <Stack.Screen name="ActivityLog" component={ActivityLogScreen} options={{ title: t(currentLang(), 'activityLog') }} />
          <Stack.Screen name="SavedSearches" component={SavedSearchesScreen} options={{ title: t(currentLang(), 'savedSearchesTitle') }} />
          <Stack.Screen name="Leases" component={LeasesScreen} options={{ title: t(currentLang(), 'leasesTitle') }} />
          <Stack.Screen name="Pipeline" component={PipelineScreen} options={{ title: t(currentLang(), 'pipeline') }} />
          <Stack.Screen name="LeadRules" component={LeadRulesScreen} options={{ title: t(currentLang(), 'leadRules') }} />
          <Stack.Screen name="Invite" component={InviteScreen} options={{ title: t(currentLang(), 'invite') }} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: t(currentLang(), 'dashboard') }} />
          <Stack.Screen name="Prices" component={PricesScreen} options={{ title: t(currentLang(), 'prices') }} />
          <Stack.Screen name="WinLoss" component={WinLossScreen} options={{ title: t(currentLang(), 'winLoss') }} />
          <Stack.Screen name="Report" component={ReportScreen} options={{ title: t(currentLang(), 'report') }} />
          <Stack.Screen name="Deals" component={DealsScreen} options={{ title: t(currentLang(), 'deals') }} />
          <Stack.Screen name="Commissions" component={CommissionsScreen} options={{ title: t(currentLang(), 'commissions') }} />
          <Stack.Screen name="Sources" component={SourcesScreen} options={{ title: t(currentLang(), 'sources') }} />
          <Stack.Screen name="Portal" component={PortalScreen} options={{ title: t(currentLang(), 'portal') }} />
          <Stack.Screen name="Links" component={LinksScreen} options={{ title: t(currentLang(), 'links') }} />
          <Stack.Screen name="Projects" component={ProjectsScreen} options={{ title: t(currentLang(), 'projects') }} />
          <Stack.Screen name="Project" component={ProjectScreen} options={({ route }) => ({ title: route.params.name })} />
          <Stack.Screen name="Library" component={LibraryScreen} options={{ title: t(currentLang(), 'library') }} />
          <Stack.Screen name="Compare" component={CompareScreen} options={{ title: t(currentLang(), 'compare') }} />
          <Stack.Screen name="Plan" component={PlanScreen} options={{ title: t(currentLang(), 'plan') }} />
          <Stack.Screen name="Usage" component={UsageScreen} options={{ title: t(currentLang(), 'usage') }} />
          <Stack.Screen name="Platform" component={PlatformScreen} options={{ title: t(currentLang(), 'platform') }} />
          <Stack.Screen name="UnitsList" component={UnitsScreen} options={{ title: t(currentLang(), 'units') }} />
          <Stack.Screen name="LeadsList" component={LeadsScreen} options={{ title: t(currentLang(), 'leadsTab') }} />
          <Stack.Screen name="MapList" component={MapScreen} options={{ title: t(currentLang(), 'mapTab') }} />
          <Stack.Screen name="TodayList" component={TodayNarrow} options={{ title: t(currentLang(), 'today') }} />
          <Stack.Screen name="Ask" component={AskNarrow} options={{ title: t(currentLang(), 'ask') }} />
          <Stack.Screen name="AddUnit" component={AddUnitNarrow} options={{ title: t(currentLang(), 'addUnit') }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
