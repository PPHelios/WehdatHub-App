import type { Rights } from '@wehdathub/shared';
import type { StringKey } from './i18n';
import type { IconName } from './components/Icon';

export type TabKey = 'Search' | 'Leads' | 'Map' | 'Units' | 'More' | 'Team' | 'Dashboard' | 'Owners' | 'AddUnit' | 'Plan' | 'Settings';

/** The tabs each role gets, left to right in English (the layout flips in Arabic), and the tab the app opens on. */
export function navPlan(r: Rights): { tabs: TabKey[]; initial: TabKey } {
  if (r.dataEntry) {
    if (!r.addUnits && !r.owners) return { tabs: ['Units', 'Search', 'More'], initial: 'Search' };
    return { tabs: ['Units', r.addUnits ? 'AddUnit' : 'Owners', 'Search', r.addUnits && r.owners ? 'Owners' : 'Settings', 'More'], initial: 'Search' };
  }
  if (r.agencyOwner) return { tabs: [r.team ? 'Team' : 'Units', 'Dashboard', 'Search', 'Leads', 'More'], initial: 'Search' };
  if (r.manager) return { tabs: [r.team ? 'Team' : 'Units', 'Leads', 'Search', 'Dashboard', 'More'], initial: 'Search' };
  if (r.teamLead) return { tabs: r.team ? ['Team', 'Leads', 'Search', 'Units', 'More'] : ['Units', 'Search', 'More'], initial: 'Search' };
  return { tabs: ['Leads', 'Units', 'Search', 'Map', 'More'], initial: 'Search' };
}

export const TAB_ICON: Record<TabKey, IconName> = { Search: 'search', Leads: 'leads', Map: 'map', Units: 'units', More: 'more', Team: 'team', Dashboard: 'dashboard', Owners: 'owners', AddUnit: 'add', Plan: 'plan', Settings: 'settings' };
export const TAB_TITLE: Record<TabKey, StringKey> = { Search: 'searchTab', Leads: 'leadsTab', Map: 'mapTab', Units: 'units', More: 'more', Team: 'team', Dashboard: 'dashboard', Owners: 'owners', AddUnit: 'addUnit', Plan: 'plan', Settings: 'more' };

export type MoreScreenName = 'Calendar' | 'SentLinks' | 'Team' | 'Ask' | 'Notifications' | 'Inbox' | 'ClientRequests' | 'Owners' | 'Requests' | 'ActivityLog' | 'Dashboard' | 'Deals' | 'Projects' | 'Library' | 'Compare' | 'Plan' | 'Usage' | 'Platform' | 'Commissions' | 'Sources' | 'Portal' | 'Prices' | 'WinLoss' | 'Report' | 'UnitsList' | 'LeadsList' | 'MapList' | 'AddUnit' | 'WhatsAppImport' | 'LeadRules' | 'Pipeline' | 'Leases' | 'SavedSearches' | 'Settings' | 'ClientsHub' | 'ProjectsHub' | 'TrackingHub' | 'DealsHub' | 'AdminHub' | 'ReportsHub' | 'SettingsHub';
export interface MoreItem { id: string; icon: IconName; label: StringKey; screen: MoreScreenName }

/**
 * The More menu for a role, in order. Anything already on the tab bar is left out, so a screen is never listed twice, and what a
 * role may not use is not listed at all (the server refuses it as well).
 */
export function moreItems(r: Rights, tabs: TabKey[], platformOwner: boolean): MoreItem[] {
  const manager = r.manager || r.agencyOwner;
  const work = !r.dataEntry; // leads, deals, viewings, Ask
  const rows: [boolean, MoreItem, TabKey?][] = [
    [work, { id: 'links', icon: 'link', label: 'sentLinks', screen: 'SentLinks' }],
    [!tabs.includes('AddUnit') && r.addUnits, { id: 'add-unit', icon: 'add', label: 'addUnit', screen: 'AddUnit' }],
    [(manager || r.dataEntry) && r.addUnits, { id: 'whatsapp-import', icon: 'import', label: 'whatsappImport', screen: 'WhatsAppImport' }],
    [!tabs.includes('Units'), { id: 'units', icon: 'units', label: 'units', screen: 'UnitsList' }],
    [work && r.leads && !tabs.includes('Leads'), { id: 'leads', icon: 'leads', label: 'leadsTab', screen: 'LeadsList' }],
    [work && !tabs.includes('Map'), { id: 'map', icon: 'map', label: 'mapTab', screen: 'MapList' }],
    [work, { id: 'calendar', icon: 'calendar', label: 'calendar', screen: 'Calendar' }],
    [work, { id: 'ask', icon: 'chat', label: 'ask', screen: 'Ask' }],
    [r.team && !tabs.includes('Team'), { id: 'team', icon: 'team', label: 'team', screen: 'Team' }],
    [r.owners && !tabs.includes('Owners'), { id: 'owners', icon: 'owners', label: 'owners', screen: 'Owners' }],
    [manager && !tabs.includes('Dashboard'), { id: 'dashboard', icon: 'dashboard', label: 'dashboard', screen: 'Dashboard' }],
    [work && r.leads, { id: 'client-requests', icon: 'clipboard', label: 'clientRequests', screen: 'ClientRequests' }],
    [work, { id: 'deals', icon: 'deal', label: 'deals', screen: 'Deals' }],
    [work, { id: 'commissions', icon: 'money', label: 'commissions', screen: 'Commissions' }],
    [manager, { id: 'winloss', icon: 'chart', label: 'winLoss', screen: 'WinLoss' }],
    [manager, { id: 'sources', icon: 'trend', label: 'sources', screen: 'Sources' }],
    [manager, { id: 'portal', icon: 'building', label: 'portal', screen: 'Portal' }],
    [work, { id: 'saved-searches', icon: 'star', label: 'savedSearchesTitle', screen: 'SavedSearches' }],
    [true, { id: 'leases', icon: 'key', label: 'leasesTitle', screen: 'Leases' }],
    [r.team, { id: 'pipeline', icon: 'board', label: 'pipeline', screen: 'Pipeline' }],
    [manager, { id: 'lead-rules', icon: 'settings', label: 'leadRules', screen: 'LeadRules' }],
    [manager, { id: 'requests', icon: 'lock', label: 'requests', screen: 'Requests' }],
    [manager, { id: 'activity', icon: 'folder', label: 'activityLog', screen: 'ActivityLog' }],
    [true, { id: 'projects', icon: 'catalogue', label: 'projects', screen: 'Projects' }],
    [manager, { id: 'library', icon: 'book', label: 'library', screen: 'Library' }],
    [work, { id: 'compare', icon: 'compare', label: 'compare', screen: 'Compare' }],
    [work, { id: 'prices', icon: 'tag', label: 'prices', screen: 'Prices' }],
    [manager && !tabs.includes('Plan'), { id: 'plan', icon: 'card', label: 'plan', screen: 'Plan' }],
    [manager, { id: 'usage', icon: 'gauge', label: 'usage', screen: 'Usage' }],
    [platformOwner, { id: 'platform', icon: 'tools', label: 'platform', screen: 'Platform' }],
    [true, { id: 'inbox', icon: 'inbox', label: 'inbox', screen: 'Inbox' }],
    [true, { id: 'notifications', icon: 'bell', label: 'notifications', screen: 'Notifications' }],
    [true, { id: 'report', icon: 'support', label: 'contactUs', screen: 'Report' }],
  ];
  return rows.filter(([show]) => show).map(([, item]) => item);
}
