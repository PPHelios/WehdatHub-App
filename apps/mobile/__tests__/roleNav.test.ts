import type { Rights } from '@wehdathub/shared';
import { moreItems, navPlan } from '../src/roleNav';

const base: Rights = { addUnits: true, editUnits: true, leads: true, search: true, team: false, owners: false, manager: false, agencyOwner: false, dataEntry: false, teamLead: false };
const ids = (r: Rights) => moreItems(r, navPlan(r).tabs, false).map((i) => i.id);

test('each role gets its own tabs and opening tab', () => {
  expect(navPlan(base)).toEqual({ tabs: ['Search', 'Leads', 'Today', 'Map', 'More'], initial: 'Today' });
  expect(navPlan({ ...base, teamLead: true, team: true })).toEqual({ tabs: ['Search', 'Team', 'Today', 'More'], initial: 'Today' });
  expect(navPlan({ ...base, manager: true, team: true, owners: true })).toEqual({ tabs: ['Today', 'Leads', 'Team', 'Search', 'More'], initial: 'Today' });
  expect(navPlan({ ...base, manager: true, agencyOwner: true, team: true })).toEqual({ tabs: ['Today', 'Dashboard', 'Team', 'Search', 'More'], initial: 'Today' });
  expect(navPlan({ ...base, dataEntry: true, leads: false, search: false })).toEqual({ tabs: ['AddUnit', 'Units', 'More'], initial: 'Units' });
  expect(navPlan({ ...base, dataEntry: true, owners: true }).tabs).toEqual(['AddUnit', 'Units', 'Owners', 'More']);
});

test('More lists sent links first for a broker, and no manager pages', () => {
  const list = ids(base);
  expect(list[0]).toBe('links');
  for (const hidden of ['requests', 'activity', 'dashboard', 'sources', 'portal', 'library', 'plan', 'usage', 'team', 'owners']) expect(list).not.toContain(hidden);
  expect(list).toContain('units');
  expect(list).not.toContain('map'); // a broker has the Map tab
});

test('data entry sees units and owners work only', () => {
  const list = ids({ ...base, dataEntry: true, leads: false, search: false, owners: true });
  for (const hidden of ['links', 'calendar', 'ask', 'deals', 'commissions', 'compare', 'prices', 'leads', 'map']) expect(list).not.toContain(hidden);
  expect(list).toEqual(expect.arrayContaining(['projects', 'notifications', 'report']));
});

test('a manager sees the manager pages, and nothing is listed that is already a tab', () => {
  const r = { ...base, manager: true, team: true, owners: true };
  const list = ids(r);
  expect(list).toEqual(expect.arrayContaining(['requests', 'activity', 'sources', 'portal', 'library', 'plan', 'usage', 'owners', 'map', 'dashboard']));
  expect(list).not.toContain('team');
  expect(list).not.toContain('today');
  expect(list).not.toContain('leads');
});
