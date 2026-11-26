import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { LeadQueue, LeadTab, PortalEnquiryRead, UnitFields, UploadFile } from '@wehdathub/shared';
import { trackScreen } from './analytics';
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth, currentLang } from './auth';
import { BottomSafe } from './components/BottomSafe';
import { PlanBanner } from './components/PlanBanner';
import { Icon } from './components/Icon';
import { FAB_TEST_ID, FloatingTabBar } from './components/FloatingTabBar';
import { MenuButton } from './components/MenuButton';
import { NotificationBell, inboxUnreadOptions } from './components/NotificationBell';
import type { IconName } from './components/Icon';
import { Logo } from './components/Logo';
import { FONT_BOLD } from './fonts';
import { LeadsScreen } from './screens/LeadsScreen';
import { MapScreen } from './screens/MapScreen';
import { LoginScreen } from './screens/LoginScreen';
import { MoreScreen } from './screens/MoreScreen';
import { TeamScreen } from './screens/TeamScreen';
import { OwnersScreen } from './screens/OwnersScreen';
import { PlanScreen } from './screens/MoreScreens';
import { pt } from './projectText';
import { DashboardScreen } from './screens/InsightsScreens';
import { SearchScreen } from './screens/SearchScreen';
import { UnitsScreen } from './screens/UnitsScreen';
import { narrow } from './layout';
import { useRightsState } from './rights';
import { TAB_TITLE } from './roleNav';
import { tabPlan } from './navFromServer';
import type { TabKey } from './roleNav';

const SearchNarrow = narrow(SearchScreen);
function MoreTab() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  return <MoreScreen onOpen={(s) => nav.navigate(s as never)} />;
}
const MoreNarrow = narrow(MoreTab);
function SettingsTab() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  return <MoreScreen mode="settings" onOpen={(s) => nav.navigate(s as never)} />;
}
const SettingsNarrow = narrow(SettingsTab);
const TeamNarrow = narrow(TeamScreen);

/**
 * Stack screens opened rarely are loaded on first visit, not at startup. The component is built once and kept, so the screen is not
 * remounted on every render; `wrap` gives it the same readable-width frame as before.
 */
function lazy(load: () => React.ComponentType<any>, wrap = false): () => React.ComponentType<any> {
  let c: React.ComponentType<any> | undefined;
  return () => (c ??= wrap ? narrow(load()) : load());
}
/* eslint-disable @typescript-eslint/no-require-imports */
const lazyScreens = {
  Unit: lazy(() => require('./screens/UnitScreen').UnitScreen, true),
  Lead: lazy(() => require('./screens/LeadScreen').LeadScreen, true),
  Contacts: lazy(() => require('./screens/ContactsScreen').ContactsScreen),
  NewLead: lazy(() => require('./screens/NewLeadScreen').NewLeadScreen, true),
  Calendar: lazy(() => require('./screens/CalendarScreen').CalendarScreen, true),
  SentLinks: lazy(() => require('./screens/SentLinksScreen').SentLinksScreen, true),
  ClientRequests: lazy(() => require('./screens/ClientRequestsScreen').ClientRequestsScreen, true),
  Inbox: lazy(() => require('./screens/InboxScreen').InboxScreen, true),
  Notifications: lazy(() => require('./screens/NotificationsScreen').NotificationsScreen, true),
  TeamMember: lazy(() => require('./screens/TeamScreen').TeamMemberScreen, true),
  Owner: lazy(() => require('./screens/OwnersScreen').OwnerScreen),
  Requests: lazy(() => require('./screens/RequestsScreen').RequestsScreen),
  ActivityLog: lazy(() => require('./screens/RequestsScreen').ActivityLogScreen),
  SavedSearches: lazy(() => require('./screens/SavedSearchesScreen').SavedSearchesScreen),
  Leases: lazy(() => require('./screens/LeasesScreen').LeasesScreen),
  Pipeline: lazy(() => require('./screens/PipelineScreen').PipelineScreen),
  LeadRules: lazy(() => require('./screens/LeadRulesScreen').LeadRulesScreen),
  Invite: lazy(() => require('./screens/InviteScreen').InviteScreen),
  Prices: lazy(() => require('./screens/InsightsScreens').PricesScreen),
  WinLoss: lazy(() => require('./screens/InsightsScreens').WinLossScreen),
  Report: lazy(() => require('./screens/InsightsScreens').ReportScreen),
  Deals: lazy(() => require('./screens/DealsScreens').DealsScreen),
  Commissions: lazy(() => require('./screens/DealsScreens').CommissionsScreen),
  Sources: lazy(() => require('./screens/DealsScreens').SourcesScreen),
  Portal: lazy(() => require('./screens/DealsScreens').PortalScreen),
  PortalEnquiry: lazy(() => require('./screens/PortalEnquiryScreen').PortalEnquiryScreen),
  Links: lazy(() => require('./screens/DealsScreens').LinksScreen),
  Projects: lazy(() => require('./screens/CatalogueScreens').ProjectsScreen),
  Project: lazy(() => require('./screens/CatalogueScreens').ProjectScreen),
  ProjectForm: lazy(() => require('./screens/ProjectFormScreen').ProjectFormScreen),
  Library: lazy(() => require('./screens/MoreScreens').LibraryScreen),
  Compare: lazy(() => require('./screens/MoreScreens').CompareScreen),
  Usage: lazy(() => require('./screens/MoreScreens').UsageScreen),
  Platform: lazy(() => require('./screens/MoreScreens').PlatformScreen),
  Ask: lazy(() => require('./screens/AskScreen').AskScreen, true),
  AddUnit: lazy(() => require('./screens/AddUnitScreen').AddUnitScreen, true),
  WhatsAppImport: lazy(() => require('./screens/WhatsAppImportScreen').WhatsAppImportScreen, true),
  ClientsHub: lazy(() => require('./screens/ClientsHubScreen').ClientsHubScreen),
  ProjectsHub: lazy(() => require('./screens/ProjectsHubScreen').ProjectsHubScreen),
  TrackingHub: lazy(() => require('./screens/TrackingHubScreen').TrackingHubScreen),
  DealsHub: lazy(() => require('./screens/DealsHubScreen').DealsHubScreen),
  AdminHub: lazy(() => require('./screens/AdminHubScreen').AdminHubScreen),
  ReportsHub: lazy(() => require('./screens/ReportsHubScreen').ReportsHubScreen),
  SettingsHub: lazy(() => require('./screens/SettingsHubScreen').SettingsHubScreen),
};
/* eslint-enable @typescript-eslint/no-require-imports */
import { t } from './i18n';
import { useTheme } from './theme';

export type AddUnitParams = {
  text?: string; photos?: UploadFile[]; voice?: UploadFile;
  /** Code of the unit to edit; the screen then edits instead of adding. */ edit?: string;
  /** Opened from the WhatsApp import: start empty (the person's own saved draft is left alone), and when saved go back to the import list. */ fresh?: boolean; importId?: string;
  /** The import reads by rules only: the message is never sent to AI. */ noAi?: boolean;
  /** The post as the import read it (the server's rules reader): the form opens with these fields filled. */ fields?: UnitFields;
  /** The code the post writes: filled even when the reader could not be reached. */ code?: string;
};
export type RootStackParams = { Tabs: undefined; MoreMenu: undefined; Settings: undefined; ClientsHub: { initialTab?: 'calendar' | 'pipeline' | 'requests' | 'compare' } | undefined; ProjectsHub: { initialTab?: 'projects' | 'library' | 'prices' | 'ask' } | undefined; TrackingHub: { initialTab?: 'links' | 'leases' | 'searches' } | undefined; DealsHub: { initialTab?: 'deals' | 'commissions' } | undefined; AdminHub: { initialTab?: 'team' | 'rules' | 'requests' | 'portals' } | undefined; ReportsHub: { initialTab?: 'dashboard' | 'winloss' | 'sources' | 'activity' } | undefined; SettingsHub: { initialTab?: 'app' | 'notifications' | 'plan' | 'support' } | undefined; Unit: { code: string; lease?: { tenantName: string; startDate: string; rent: string } }; Leases: undefined; SavedSearches: undefined; Lead: { ref: string }; NewLead: { name?: string; phone?: string; paste?: string } | undefined; Contacts: undefined; Calendar: { tomorrow?: boolean } | undefined; SentLinks: { search?: string; opened?: boolean; days?: number; leadRef?: string; leadLabel?: string } | undefined; Notifications: undefined; Inbox: undefined; ClientRequests: undefined; Team: { order?: 'overdue' | 'available' } | undefined; Owners: undefined; Owner: { id: string; name: string }; Requests: undefined; ActivityLog: undefined; Invite: undefined; LeadRules: undefined; Dashboard: undefined; Deals: { from?: string; to?: string; brokerId?: string; brokerRole?: 'closer' | 'participant'; market?: 'resale' | 'primary' | 'unknown'; area?: string } | undefined; Projects: undefined; Project: { id: string; name: string }; ProjectForm: { id?: string } | undefined; Library: undefined; Compare: undefined; Plan: undefined; Usage: undefined; Platform: undefined; Commissions: { kind?: 'resale' | 'developers'; developerId?: string; developerName?: string; overdue?: boolean } | undefined; Sources: { signedOnly?: boolean } | undefined; Portal: undefined; PortalEnquiry: { message: string; enquiry?: PortalEnquiryRead }; Links: { search?: string; opened?: boolean; days?: number; leadRef?: string; leadLabel?: string } | undefined; Prices: undefined; WinLoss: undefined; Report: undefined; UnitsList: { old?: boolean; missingPhotos?: boolean } | undefined; LeadsList: { tab?: LeadTab; broker?: string; team?: string; queue?: LeadQueue } | undefined; Pipeline: undefined; MapList: undefined; TeamMember: { id: string; name: string; role?: string; me?: boolean; teamLeadId?: string | null }; Ask: undefined; AddUnit: AddUnitParams | undefined; WhatsAppImport: { zip?: UploadFile; saved?: { id: string; code: string } } | undefined };
export const navigationRef = createNavigationContainerRef<RootStackParams>();
type TabParams = Record<TabKey | 'AddUnitTab', undefined>;

const Stack = createNativeStackNavigator<RootStackParams>();
const Tabs = createBottomTabNavigator<TabParams>();

/** Tab bar icon: the line icon; the active tab's icon is filled with the brand colour. */
const tabIcon = (name: IconName) => ({ color, focused }: { color: string; focused: boolean }) => <Icon name={name} color={color} size={22} fill={focused ? `${color}44` : undefined} />;

/** Add unit on the tab bar is a button, not a screen: pressing it opens the form on top of the tabs. */
const NothingHere = () => null;

/** Every tab's screen. Module level: the map never changes. */
const TAB_SCREENS: Record<TabKey, React.ComponentType> = { Search: SearchNarrow, Leads: LeadsScreen, Map: MapScreen, Units: UnitsScreen, More: MoreNarrow, Team: TeamNarrow, Dashboard: DashboardScreen, Owners: OwnersScreen, AddUnit: NothingHere, Plan: PlanScreen, Settings: SettingsNarrow };
const renderTabBar = (props: BottomTabBarProps) => <FloatingTabBar {...props} />;
const openInbox = () => navigationRef.navigate('Inbox');
const openMoreMenu = () => navigationRef.navigate('MoreMenu');
const addUnitListeners = { tabPress: (e: { preventDefault: () => void }) => { e.preventDefault(); navigationRef.navigate('AddUnit'); } };

function TabsScreen() {
  const lang = currentLang();
  const { rights, ready, nav } = useRightsState();
  const { colors } = useTheme();
  const { bg, border, text } = colors;
  // The only poll of the unread count (once a minute, paused in the background); the bell reads the same query.
  useQuery({ ...inboxUnreadOptions, refetchInterval: 60_000, enabled: ready });
  const plan = useMemo(() => (ready ? tabPlan(nav, rights) : null), [ready, nav, rights]);
  const hasMoreTab = Boolean(plan?.tabs.some((x) => x.key === 'More'));
  const headerRight = useCallback(() => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <NotificationBell onPress={openInbox} />
      {hasMoreTab ? null : <MenuButton onPress={openMoreMenu} />}
    </View>
  ), [hasMoreTab]);
  const screenOptions = useMemo<BottomTabNavigationOptions>(() => ({
    headerTitleAlign: 'center',
    headerLeft: () => <View style={{ paddingHorizontal: 8 }}><Logo bar /></View>,
    headerStyle: { backgroundColor: bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border },
    headerTitleStyle: { color: text, fontFamily: FONT_BOLD },
    headerShadowVisible: false,
    headerRight,
  }), [bg, border, text, headerRight]);
  const tabOptions = useMemo(() => (plan?.tabs ?? []).map((spec) => ({ title: spec.label ? spec.label[lang] : t(lang, TAB_TITLE[spec.key]), tabBarIcon: tabIcon(spec.icon), tabBarButtonTestID: spec.fab ? FAB_TEST_ID : undefined })), [plan, lang]);
  if (!plan) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primaryInk} />
      </View>
    );
  }
  return (
    <Tabs.Navigator tabBar={renderTabBar} initialRouteName={plan.initial} screenOptions={screenOptions}>
      {plan.tabs.map((spec, i) => {
        const k = spec.key;
        return (
          <Tabs.Screen
            key={k}
            name={k === 'AddUnit' ? 'AddUnitTab' : k}
            component={TAB_SCREENS[k]}
            options={k === 'Search' ? { ...tabOptions[i], headerTitle: '', headerLeft: () => <View style={{ paddingHorizontal: 12 }}><Logo compact size={0.45} /></View> } : tabOptions[i]}
            listeners={k === 'AddUnit' ? addUnitListeners : undefined}
          />
        );
      })}
    </Tabs.Navigator>
  );
}

export function RootNavigation() {
  const status = useAuth((s) => s.status);
  const { colors, scheme } = useTheme();
  const { primary, bg, card, text, border, danger } = colors;
  const theme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, primary, background: bg, card, text, border, notification: danger } };
  }, [scheme, primary, bg, card, text, border, danger]);
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 32 }}>
        <Logo bilingual />
        <ActivityIndicator color={colors.spinner} />
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
        <Stack.Navigator screenLayout={({ children, options, route }) => (
          <BottomSafe>
            {route.name === 'Unit' ? (
              <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
                <PlanBanner onOpenPlan={() => navigationRef.navigate('Plan')} />
                {children}
              </SafeAreaView>
            ) : <><PlanBanner topInset={options.headerShown === false} onOpenPlan={() => navigationRef.navigate('Plan')} />{children}</>}
          </BottomSafe>
        )} screenOptions={{ headerTitleStyle: { fontFamily: FONT_BOLD }, headerTintColor: colors.text, headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false, headerRight: () => <View style={{ paddingHorizontal: 8 }}><Logo bar /></View> }}>
          <Stack.Screen name="Tabs" component={TabsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Unit" getComponent={lazyScreens.Unit} options={{ headerShown: false }} />
          <Stack.Screen name="Lead" getComponent={lazyScreens.Lead} options={{ title: t(currentLang(), 'leadsTab') }} />
          <Stack.Screen name="Contacts" getComponent={lazyScreens.Contacts} options={{ title: t(currentLang(), 'fromContacts') }} />
          <Stack.Screen name="NewLead" getComponent={lazyScreens.NewLead} options={{ title: t(currentLang(), 'newLead') }} />
          <Stack.Screen name="Calendar" getComponent={lazyScreens.Calendar} options={{ title: t(currentLang(), 'calendar') }} />
          <Stack.Screen name="SentLinks" getComponent={lazyScreens.SentLinks} options={{ title: t(currentLang(), 'sentLinks') }} />
          <Stack.Screen name="ClientRequests" getComponent={lazyScreens.ClientRequests} options={{ title: t(currentLang(), 'clientRequests') }} />
          <Stack.Screen name="Inbox" getComponent={lazyScreens.Inbox} options={{ title: t(currentLang(), 'inbox') }} />
          <Stack.Screen name="MoreMenu" component={MoreNarrow} options={{ title: t(currentLang(), 'more') }} />
          <Stack.Screen name="Settings" component={SettingsNarrow} options={{ title: currentLang() === 'ar' ? 'الإعدادات' : 'Settings' }} />
          <Stack.Screen name="Notifications" getComponent={lazyScreens.Notifications} options={{ title: t(currentLang(), 'notifications') }} />
          <Stack.Screen name="Team" component={TeamNarrow} options={{ title: t(currentLang(), 'team') }} />
          <Stack.Screen name="TeamMember" getComponent={lazyScreens.TeamMember} options={({ route }) => ({ title: route.params.name })} />
          <Stack.Screen name="Owners" component={OwnersScreen} options={{ title: t(currentLang(), 'owners') }} />
          <Stack.Screen name="Owner" getComponent={lazyScreens.Owner} options={({ route }) => ({ title: route.params.name })} />
          <Stack.Screen name="Requests" getComponent={lazyScreens.Requests} options={{ title: t(currentLang(), 'requests') }} />
          <Stack.Screen name="ActivityLog" getComponent={lazyScreens.ActivityLog} options={{ title: t(currentLang(), 'activityLog') }} />
          <Stack.Screen name="SavedSearches" getComponent={lazyScreens.SavedSearches} options={{ title: t(currentLang(), 'savedSearchesTitle') }} />
          <Stack.Screen name="Leases" getComponent={lazyScreens.Leases} options={{ title: t(currentLang(), 'leasesTitle') }} />
          <Stack.Screen name="Pipeline" getComponent={lazyScreens.Pipeline} options={{ title: t(currentLang(), 'pipeline') }} />
          <Stack.Screen name="LeadRules" getComponent={lazyScreens.LeadRules} options={{ title: t(currentLang(), 'leadRules') }} />
          <Stack.Screen name="Invite" getComponent={lazyScreens.Invite} options={{ title: t(currentLang(), 'invite') }} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: t(currentLang(), 'dashboard') }} />
          <Stack.Screen name="Prices" getComponent={lazyScreens.Prices} options={{ title: t(currentLang(), 'prices') }} />
          <Stack.Screen name="WinLoss" getComponent={lazyScreens.WinLoss} options={{ title: t(currentLang(), 'winLoss') }} />
          <Stack.Screen name="Report" getComponent={lazyScreens.Report} options={{ title: t(currentLang(), 'report') }} />
          <Stack.Screen name="Deals" getComponent={lazyScreens.Deals} options={{ title: t(currentLang(), 'deals') }} />
          <Stack.Screen name="Commissions" getComponent={lazyScreens.Commissions} options={{ title: t(currentLang(), 'commissions') }} />
          <Stack.Screen name="Sources" getComponent={lazyScreens.Sources} options={{ title: t(currentLang(), 'sources') }} />
          <Stack.Screen name="Portal" getComponent={lazyScreens.Portal} options={{ title: t(currentLang(), 'portal') }} />
          <Stack.Screen name="PortalEnquiry" getComponent={lazyScreens.PortalEnquiry} options={{ title: t(currentLang(), 'peTitle') }} />
          <Stack.Screen name="Links" getComponent={lazyScreens.Links} options={{ title: t(currentLang(), 'links') }} />
          <Stack.Screen name="Projects" getComponent={lazyScreens.Projects} options={{ title: t(currentLang(), 'projects') }} />
          <Stack.Screen name="Project" getComponent={lazyScreens.Project} options={({ route }) => ({ title: route.params.name })} />
          <Stack.Screen name="ProjectForm" getComponent={lazyScreens.ProjectForm} options={({ route }) => ({ title: route.params?.id ? pt(currentLang()).editProject : pt(currentLang()).newProject })} />
          <Stack.Screen name="Library" getComponent={lazyScreens.Library} options={{ title: t(currentLang(), 'library') }} />
          <Stack.Screen name="Compare" getComponent={lazyScreens.Compare} options={{ title: t(currentLang(), 'compare') }} />
          <Stack.Screen name="Plan" component={PlanScreen} options={{ title: t(currentLang(), 'plan') }} />
          <Stack.Screen name="Usage" getComponent={lazyScreens.Usage} options={{ title: t(currentLang(), 'usage') }} />
          <Stack.Screen name="Platform" getComponent={lazyScreens.Platform} options={{ title: t(currentLang(), 'platform') }} />
          <Stack.Screen name="UnitsList" component={UnitsScreen} options={{ title: t(currentLang(), 'units') }} />
          <Stack.Screen name="LeadsList" component={LeadsScreen} options={{ title: t(currentLang(), 'leadsTab') }} />
          <Stack.Screen name="MapList" component={MapScreen} options={{ title: t(currentLang(), 'mapTab') }} />
          <Stack.Screen name="Ask" getComponent={lazyScreens.Ask} options={{ title: t(currentLang(), 'ask') }} />
          <Stack.Screen name="AddUnit" getComponent={lazyScreens.AddUnit} options={{ title: t(currentLang(), 'addUnit') }} />
          <Stack.Screen name="WhatsAppImport" getComponent={lazyScreens.WhatsAppImport} options={{ title: t(currentLang(), 'whatsappImport') }} />
          <Stack.Screen name="ClientsHub" getComponent={lazyScreens.ClientsHub} options={{ title: currentLang() === 'ar' ? 'العملاء' : 'Clients' }} />
          <Stack.Screen name="ProjectsHub" getComponent={lazyScreens.ProjectsHub} options={{ title: currentLang() === 'ar' ? 'المشاريع' : 'Projects' }} />
          <Stack.Screen name="TrackingHub" getComponent={lazyScreens.TrackingHub} options={{ title: currentLang() === 'ar' ? 'المتابعة' : 'Tracking' }} />
          <Stack.Screen name="DealsHub" getComponent={lazyScreens.DealsHub} options={{ title: currentLang() === 'ar' ? 'الصفقات' : 'Deals' }} />
          <Stack.Screen name="AdminHub" getComponent={lazyScreens.AdminHub} options={{ title: currentLang() === 'ar' ? 'إدارة الشركة' : 'Agency Admin' }} />
          <Stack.Screen name="ReportsHub" getComponent={lazyScreens.ReportsHub} options={{ title: currentLang() === 'ar' ? 'تقارير الشركة' : 'Agency Reports' }} />
          <Stack.Screen name="SettingsHub" getComponent={lazyScreens.SettingsHub} options={{ title: currentLang() === 'ar' ? 'الإعدادات' : 'Settings' }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
