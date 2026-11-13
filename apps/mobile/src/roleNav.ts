import type { Rights } from '@wehdathub/shared';
import type { StringKey } from './i18n';
import type { IconName } from './components/Icon';

export type TabKey = 'Today' | 'Search' | 'Leads' | 'Map' | 'Units' | 'More' | 'Team' | 'Dashboard' | 'Owners' | 'AddUnit' | 'Plan';

/** The tabs each role gets, left to right in English (the layout flips in Arabic), and the tab the app opens on. */
export function navPlan(r: Rights): { tabs: TabKey[]; initial: TabKey } {
  if (r.dataEntry) return { tabs: r.owners ? ['AddUnit', 'Units', 'Owners', 'More'] : ['AddUnit', 'Units', 'More'], initial: 'Units' };
  if (r.agencyOwner) return { tabs: ['Dashboard', 'Team', 'Search', 'Plan', 'More'], initial: 'Search' };
  if (r.manager) return { tabs: ['Dashboard', 'Team', 'Leads', 'Search', 'More'], initial: 'Leads' };
  if (r.teamLead) return { tabs: ['Search', 'Team', 'Today', 'More'], initial: 'Today' };
  return { tabs: ['Search', 'Leads', 'Today', 'Map', 'More'], initial: 'Today' };
}

export const TAB_ICON: Record<TabKey, IconName> = { Today: 'today', Search: 'search', Leads: 'leads', Map: 'map', Units: 'units', More: 'more', Team: 'team', Dashboard: 'dashboard', Owners: 'owners', AddUnit: 'add', Plan: 'plan' };
export const TAB_TITLE: Record<TabKey, StringKey> = { Today: 'today', Search: 'searchTab', Leads: 'leadsTab', Map: 'mapTab', Units: 'units', More: 'more', Team: 'team', Dashboard: 'dashboard', Owners: 'owners', AddUnit: 'addUnit', Plan: 'plan' };

export type MoreScreenName = 'Calendar' | 'SentLinks' | 'Team' | 'Ask' | 'Notifications' | 'Owners' | 'Requests' | 'ActivityLog' | 'Dashboard' | 'Deals' | 'Projects' | 'Library' | 'Compare' | 'Plan' | 'Usage' | 'Platform' | 'Commissions' | 'Sources' | 'Portal' | 'Prices' | 'WinLoss' | 'Report' | 'UnitsList' | 'LeadsList' | 'MapList' | 'TodayList' | 'AddUnit' | 'LeadRules' | 'Pipeline';
export interface MoreItem { id: string; icon: string; label: StringKey; screen: MoreScreenName }

/**
 * The More menu for a role, in order. Anything already on the tab bar is left out, so a screen is never listed twice, and what a
 * role may not use is not listed at all (the server refuses it as well).
 */
export function moreItems(r: Rights, tabs: TabKey[], platformOwner: boolean): MoreItem[] {
  const manager = r.manager || r.agencyOwner;
  const work = !r.dataEntry; // leads, deals, viewings, Ask
  const rows: [boolean, MoreItem, TabKey?][] = [
    [work, { id: 'links', icon: '👁', label: 'sentLinks', screen: 'SentLinks' }],
    [!tabs.includes('AddUnit') && r.addUnits, { id: 'add-unit', icon: '＋', label: 'addUnit', screen: 'AddUnit' }],
    [!tabs.includes('Units'), { id: 'units', icon: '▤', label: 'units', screen: 'UnitsList' }],
    [work && r.leads && !tabs.includes('Today'), { id: 'today', icon: '🏠', label: 'today', screen: 'TodayList' }],
    [work && r.leads && !tabs.includes('Leads'), { id: 'leads', icon: '👤', label: 'leadsTab', screen: 'LeadsList' }],
    [work && !tabs.includes('Map'), { id: 'map', icon: '📍', label: 'mapTab', screen: 'MapList' }],
    [work, { id: 'calendar', icon: '🗓', label: 'calendar', screen: 'Calendar' }],
    [work, { id: 'ask', icon: '💬', label: 'ask', screen: 'Ask' }],
    [r.team && !tabs.includes('Team'), { id: 'team', icon: '👥', label: 'team', screen: 'Team' }],
    [r.owners && !tabs.includes('Owners'), { id: 'owners', icon: '🗝', label: 'owners', screen: 'Owners' }],
    [manager && !tabs.includes('Dashboard'), { id: 'dashboard', icon: '📊', label: 'dashboard', screen: 'Dashboard' }],
    [work, { id: 'deals', icon: '🤝', label: 'deals', screen: 'Deals' }],
    [work, { id: 'commissions', icon: '💸', label: 'commissions', screen: 'Commissions' }],
    [manager, { id: 'winloss', icon: '📉', label: 'winLoss', screen: 'WinLoss' }],
    [manager, { id: 'sources', icon: '📈', label: 'sources', screen: 'Sources' }],
    [manager, { id: 'portal', icon: '🏢', label: 'portal', screen: 'Portal' }],
    [r.team, { id: 'pipeline', icon: '🧭', label: 'pipeline', screen: 'Pipeline' }],
    [manager, { id: 'lead-rules', icon: '⚙️', label: 'leadRules', screen: 'LeadRules' }],
    [manager, { id: 'requests', icon: '🔒', label: 'requests', screen: 'Requests' }],
    [manager, { id: 'activity', icon: '🗂', label: 'activityLog', screen: 'ActivityLog' }],
    [true, { id: 'projects', icon: '🏗', label: 'projects', screen: 'Projects' }],
    [manager, { id: 'library', icon: '📚', label: 'library', screen: 'Library' }],
    [work, { id: 'compare', icon: '⚖️', label: 'compare', screen: 'Compare' }],
    [work, { id: 'prices', icon: '💰', label: 'prices', screen: 'Prices' }],
    [manager && !tabs.includes('Plan'), { id: 'plan', icon: '💳', label: 'plan', screen: 'Plan' }],
    [manager, { id: 'usage', icon: '📶', label: 'usage', screen: 'Usage' }],
    [platformOwner, { id: 'platform', icon: '🛰', label: 'platform', screen: 'Platform' }],
    [true, { id: 'notifications', icon: '🔔', label: 'notifications', screen: 'Notifications' }],
    [true, { id: 'report', icon: '🐞', label: 'report', screen: 'Report' }],
  ];
  return rows.filter(([show]) => show).map(([, item]) => item);
}
