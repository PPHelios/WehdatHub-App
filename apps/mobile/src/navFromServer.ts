import type { Nav, NavLabel, Rights } from '@wehdathub/shared';
import { ICON_NAMES } from './components/Icon';
import type { IconName } from './components/Icon';
import { navPlan, TAB_ICON } from './roleNav';
import type { MoreScreenName, TabKey } from './roleNav';

/** Mobile uses the server menu for visibility and arranges the bar around Search. */
/** The server's tab names the app can open (anything else is skipped, never crashes). */
const TAB_BY_APP: Record<string, TabKey> = { Search: 'Search', Map: 'Map', AddUnit: 'AddUnit', Leads: 'Leads', Units: 'Units', Team: 'Team', Owners: 'Owners', Settings: 'Settings', Dashboard: 'Dashboard', More: 'More' };

/** The screens a More row can open. */
const SCREENS: ReadonlySet<string> = new Set<MoreScreenName>([
  'Calendar', 'SentLinks', 'Team', 'Ask', 'Notifications', 'Inbox', 'ClientRequests', 'Owners', 'Requests', 'ActivityLog', 'Dashboard', 'Deals', 'Projects', 'Library', 'Compare',
  'Plan', 'Usage', 'Platform', 'Commissions', 'Sources', 'Portal', 'Prices', 'WinLoss', 'Report', 'UnitsList', 'LeadsList', 'MapList', 'AddUnit', 'WhatsAppImport',
  'LeadRules', 'Pipeline', 'Leases', 'SavedSearches', 'Settings',
  'ClientsHub', 'ProjectsHub', 'TrackingHub', 'DealsHub', 'AdminHub', 'ReportsHub', 'SettingsHub',
]);

/** The website's icon names the app draws under another name. */
const ICON_ALIAS: Record<string, IconName> = { home: 'today', plus: 'add' };
const ICONS: ReadonlySet<string> = new Set<string>(ICON_NAMES);

/** The app's icon for a server icon name (the same names as the website); an unknown name draws the menu icon. */
export function iconFor(name: string): IconName {
  if (ICON_ALIAS[name]) return ICON_ALIAS[name];
  return ICONS.has(name) ? (name as IconName) : 'more';
}

/** Search is the filled centre shortcut on mobile. */
export interface TabSpec { key: TabKey; icon: IconName; label?: NavLabel; fab?: boolean }

/** Groups that start open before the person's own choice. */
export const GROUP_OPEN: ReadonlySet<string> = new Set(['clients', 'listings']);

/** The server menu to use, or null when the older role logic applies (old server, or the product owner). */
export function usableNav(nav: Nav | undefined | null): Nav | null {
  if (!nav || !Array.isArray(nav.tabs) || !Array.isArray(nav.groups) || nav.role === 'crm') return null;
  return nav.tabs.some((t) => t.app && TAB_BY_APP[t.app]) ? nav : null;
}

const MENU_TABS: Partial<Record<string, TabKey>> = {
  LeadsList: 'Leads', UnitsList: 'Units', MapList: 'Map', Dashboard: 'Dashboard',
  Team: 'Team', Owners: 'Owners', Settings: 'Settings', AddUnit: 'AddUnit',
};

/** Preserve server-visible destinations and balance both sides of the Search shortcut. */
export function tabPlan(nav: Nav | undefined | null, rights: Rights): { tabs: TabSpec[]; initial: TabKey } {
  const n = usableNav(nav);
  if (!n) {
    const p = navPlan(rights);
    return { tabs: p.tabs.map((key) => ({ key, icon: TAB_ICON[key], fab: key === 'Search' })), initial: p.initial };
  }
  const tabs: TabSpec[] = [];
  const publishedSearch = n.tabs.find((tab) => tab.app === 'Search');
  const search: TabSpec = { key: 'Search', icon: 'search', label: publishedSearch?.label, fab: true };
  for (const tab of n.tabs) {
    const key = tab.app ? TAB_BY_APP[tab.app] : undefined;
    if (key && key !== 'Search' && (key !== 'AddUnit' || rights.addUnits)) {
      tabs.push({ key, icon: iconFor(tab.icon), label: tab.label });
    }
  }
  if (tabs.length % 2 !== 0) {
    const existing = new Set(tabs.map((tab) => tab.key));
    const items = n.groups.flatMap((group) => group.items);
    const order: TabKey[] = n.role === 'manager' ? ['Dashboard', 'Units', 'Map'] : ['Units', 'Leads', 'Map'];
    const extra = order.find((key) => !existing.has(key) && items.some((item) => MENU_TABS[item.app ?? ''] === key));
    if (extra && n.role !== 'data_entry') {
      const item = items.find((row) => MENU_TABS[row.app ?? ''] === extra);
      tabs.splice(Math.max(0, tabs.length - 1), 0, { key: extra, icon: TAB_ICON[extra], label: item?.label });
    } else {
      const key = existing.has('More') ? 'Settings' : 'More';
      if (existing.has(key)) tabs.splice(tabs.findIndex((tab) => tab.key === key), 1);
      else tabs.push({ key, icon: TAB_ICON[key] });
    }
  }
  tabs.splice(tabs.length / 2, 0, search);
  return { tabs, initial: 'Search' };
}

export interface MoreRow { id: string; icon: IconName; label: NavLabel; screen: MoreScreenName }
export interface MoreSection { key: string; label: NavLabel; rows: MoreRow[] }

/**
 * The grouped More list: the server's groups in order, the rows this person can open, none repeated from the bottom bar.
 * The agency switch for adding units also hides the WhatsApp import (the server refuses it as well).
 */
export function moreSections(nav: Nav | undefined | null, rights: Rights): MoreSection[] | null {
  const n = usableNav(nav);
  if (!n) return null;
  const bar = new Set(tabPlan(n, rights).tabs.map((tab) => tab.key));
  return n.groups
    .map((g) => ({
      key: g.key,
      label: g.label,
      rows: g.items
        .filter((i) => {
          if (!i.app || !SCREENS.has(i.app) || (i.key === 'waimport' && !rights.addUnits)) return false;
          const tab = MENU_TABS[i.app];
          return !tab || !bar.has(tab);
        })
        .map((i) => ({ id: i.key, icon: iconFor(i.icon), label: i.label, screen: i.app as MoreScreenName })),
    }))
    .filter((g) => g.rows.length);
}
