import type { Nav, NavLabel, Rights } from '@wehdathub/shared';
import { ICON_NAMES } from './components/Icon';
import type { IconName } from './components/Icon';
import { navPlan } from './roleNav';
import type { MoreScreenName, TabKey } from './roleNav';

/**
 * The tabs and the More list come from the server's menu (`nav` on /me), the same data the website draws, so a role never
 * differs between the two. An old server (no `nav`) or the product owner (no app tracking pages here) keeps the older role
 * logic in roleNav.ts.
 */

/** The server's tab names the app can open (anything else is skipped, never crashes). */
const TAB_BY_APP: Record<string, TabKey> = { Today: 'Today', Search: 'Search', AddUnit: 'AddUnit', Leads: 'Leads', Units: 'Units', Team: 'Team', Owners: 'Owners', Settings: 'Settings' };

/** The screens a More row can open. */
const SCREENS: ReadonlySet<string> = new Set<MoreScreenName>([
  'Calendar', 'SentLinks', 'Team', 'Ask', 'Notifications', 'Inbox', 'ClientRequests', 'Owners', 'Requests', 'ActivityLog', 'Dashboard', 'Deals', 'Projects', 'Library', 'Compare',
  'Plan', 'Usage', 'Platform', 'Commissions', 'Sources', 'Portal', 'Prices', 'WinLoss', 'Report', 'UnitsList', 'LeadsList', 'MapList', 'TodayList', 'AddUnit', 'WhatsAppImport',
  'LeadRules', 'Pipeline', 'Leases', 'SavedSearches', 'Settings',
]);

/** The website's icon names the app draws under another name. */
const ICON_ALIAS: Record<string, IconName> = { home: 'today', plus: 'add' };
const ICONS: ReadonlySet<string> = new Set<string>(ICON_NAMES);

/** The app's icon for a server icon name (the same names as the website); an unknown name draws the menu icon. */
export function iconFor(name: string): IconName {
  if (ICON_ALIAS[name]) return ICON_ALIAS[name];
  return ICONS.has(name) ? (name as IconName) : 'more';
}

export interface TabSpec { key: TabKey; icon: IconName; label?: NavLabel }

/** Groups that start open before the person's own choice. */
export const GROUP_OPEN: ReadonlySet<string> = new Set(['clients', 'listings']);

/** The server menu to use, or null when the older role logic applies (old server, or the product owner). */
export function usableNav(nav: Nav | undefined | null): Nav | null {
  if (!nav || !Array.isArray(nav.tabs) || !Array.isArray(nav.groups) || nav.role === 'crm') return null;
  return nav.tabs.some((t) => t.app && TAB_BY_APP[t.app]) ? nav : null;
}

/** The bottom tabs for this person, left to right in English, and the tab the app opens on. */
export function tabPlan(nav: Nav | undefined | null, rights: Rights): { tabs: TabSpec[]; initial: TabKey } {
  const n = usableNav(nav);
  if (!n) {
    const p = navPlan(rights);
    return { tabs: p.tabs.map((key) => ({ key, icon: LEGACY_ICON[key] })), initial: p.initial };
  }
  const tabs: TabSpec[] = [];
  for (const t of n.tabs) {
    const key = t.app ? TAB_BY_APP[t.app] : undefined;
    if (key) tabs.push({ key, icon: iconFor(t.icon), label: t.label });
  }
  const initial: TabKey = tabs.some((t) => t.key === 'Today') ? 'Today' : tabs.some((t) => t.key === 'Units') ? 'Units' : tabs[0].key;
  return { tabs, initial };
}

const LEGACY_ICON: Record<TabKey, IconName> = { Today: 'today', Search: 'search', Leads: 'leads', Map: 'map', Units: 'units', More: 'more', Team: 'team', Dashboard: 'dashboard', Owners: 'owners', AddUnit: 'add', Plan: 'plan', Settings: 'settings' };

export interface MoreRow { id: string; icon: IconName; label: NavLabel; screen: MoreScreenName }
export interface MoreSection { key: string; label: NavLabel; rows: MoreRow[] }

/**
 * The grouped More list: the server's groups in order, the rows this person can open, none repeated from the bottom bar.
 * The agency switch for adding units also hides the WhatsApp import (the server refuses it as well).
 */
export function moreSections(nav: Nav | undefined | null, rights: Rights): MoreSection[] | null {
  const n = usableNav(nav);
  if (!n) return null;
  return n.groups
    .map((g) => ({
      key: g.key,
      label: g.label,
      rows: g.items
        .filter((i) => i.app && SCREENS.has(i.app) && !i.onBar && !(i.key === 'waimport' && !rights.addUnits))
        .map((i) => ({ id: i.key, icon: iconFor(i.icon), label: i.label, screen: i.app as MoreScreenName })),
    }))
    .filter((g) => g.rows.length);
}
