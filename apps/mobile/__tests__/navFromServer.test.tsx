import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { AiUsage, Nav, Rights } from '@wehdathub/shared';
import { ICON_NAMES } from '../src/components/Icon';
import { iconFor, moreSections, tabPlan, usableNav } from '../src/navFromServer';
import { AiUsageCard } from '../src/screens/MoreScreens';

// The test runs under Node: the file system and the server repo next to this one.
declare const require: (id: string) => any;
declare const __dirname: string;
const base: Rights = { addUnits: true, editUnits: true, leads: true, search: true, team: false, owners: false, manager: false, agencyOwner: false, dataEntry: false, teamLead: false };

const mkTab = (key: string, app: string, icon: string, en = key, extra = {}) => ({ key, label: { ar: en, en }, icon, web: `/app/${key}`, app, ...extra });
const mkItem = (key: string, app: string | null, icon: string, onBar = false) => ({ key, label: { ar: key, en: key }, icon, web: `/app/${key}`, app, onBar });

/** What the server sends a broker (a trimmed copy of lib/navSpec.js output). */
const broker: Nav = {
  role: 'broker',
  tabs: [mkTab('home', 'Today', 'home'), mkTab('search', 'Search', 'search'), mkTab('add', 'AddUnit', 'plus', 'Add', { fab: true }), mkTab('leads', 'Leads', 'leads'), mkTab('units', 'Units', 'units')],
  groups: [
    { key: 'clients', label: { ar: 'العملاء', en: 'Clients' }, items: [mkItem('leads', 'LeadsList', 'leads', true), mkItem('requests', 'ClientRequests', 'clipboard'), mkItem('leases', 'Leases', 'key'), mkItem('inbox', 'Inbox', 'inbox')] },
    { key: 'listings', label: { ar: 'الوحدات', en: 'Listings' }, items: [mkItem('units', 'UnitsList', 'units', true), mkItem('map', 'MapList', 'pin'), mkItem('waimport', 'WhatsAppImport', 'import'), mkItem('import', null, 'import')] },
    { key: 'account', label: { ar: 'حسابي', en: 'Account' }, items: [mkItem('settings', 'Settings', 'settings'), mkItem('notifications', 'Notifications', 'bell'), mkItem('guide', null, 'book')] },
  ],
};
const dataEntry: Nav = {
  role: 'data_entry',
  tabs: [mkTab('search', 'Search', 'search'), mkTab('units', 'Units', 'units'), mkTab('add', 'AddUnit', 'plus', 'Add', { fab: true }), mkTab('owners', 'Owners', 'key-people'), mkTab('settings', 'Settings', 'settings')],
  groups: [{ key: 'account', label: { ar: 'حسابي', en: 'Account' }, items: [mkItem('notifications', 'Notifications', 'bell')] }],
};

test('Search is centred while the other tabs retain server labels', () => {
  const p = tabPlan(broker, base);
  expect(p.tabs.map((t) => t.key)).toEqual(['AddUnit', 'Leads', 'Search', 'Map', 'Units']);
  expect(p.tabs[0].label?.en).toBe('Add');
  expect(p.initial).toBe('Search');
  const d = tabPlan(dataEntry, { ...base, dataEntry: true });
  expect(d.tabs.map((t) => t.key)).toEqual(['Units', 'AddUnit', 'Search', 'Owners', 'Settings']);
  expect(d.initial).toBe('Search');
});

test('Data Entry opens centred Search even when the server omits it and Owners is disabled', () => {
  const rights = { ...base, dataEntry: true, owners: false, leads: false, search: false };
  const nav = { ...dataEntry, tabs: dataEntry.tabs.filter((tab) => tab.app !== 'Search' && tab.app !== 'Owners') };
  const p = tabPlan(nav, rights);
  expect(p.initial).toBe('Search');
  expect(p.tabs.map((tab) => tab.key)).toEqual(['Units', 'AddUnit', 'Search', 'Settings', 'More']);
  expect(p.tabs[2]).toMatchObject({ key: 'Search', icon: 'search', fab: true });
});

test('an old server (no menu) or the product owner keeps the older tabs', () => {
  expect(usableNav(undefined)).toBeNull();
  expect(usableNav({ ...broker, role: 'crm' })).toBeNull();
  expect(tabPlan(undefined, base).tabs.map((t) => t.key)).toEqual(['Leads', 'Units', 'Search', 'Map', 'More']);
  expect(moreSections(undefined, base)).toBeNull();
});

test('More: the server groups in order, only rows the app can open, none repeated from the bar', () => {
  const s = moreSections(broker, base)!;
  expect(s.map((g) => g.key)).toEqual(['clients', 'listings', 'account']);
  const ids = s.flatMap((g) => g.rows.map((r) => r.id));
  expect(ids).toEqual(['requests', 'leases', 'inbox', 'waimport', 'settings', 'notifications']);
  expect(ids).not.toContain('leads'); // on the bar
  expect(ids).not.toContain('import'); // a website page, no app screen
  expect(ids).toContain('settings'); // opens the Settings screen (Me, Agency, Plan and billing)
  expect(s[0].label.en).toBe('Clients');
});

test('the WhatsApp import is hidden when the agency switched adding units off', () => {
  const ids = moreSections(broker, { ...base, addUnits: false })!.flatMap((g) => g.rows.map((r) => r.id));
  expect(ids).not.toContain('waimport');
});

test('a group with no rows is left out', () => {
  const s = moreSections(dataEntry, { ...base, dataEntry: true })!;
  expect(s.map((g) => g.key)).toEqual(['account']);
});

test('every icon name the menu sends exists in the app, and an unknown name never crashes', () => {
  const names = new Set<string>();
  for (const n of [broker, dataEntry]) {
    for (const t of n.tabs) names.add(t.icon);
    for (const g of n.groups) for (const i of g.items) names.add(i.icon);
  }
  for (const name of names) expect(ICON_NAMES).toContain(iconFor(name));
  expect(iconFor('home')).toBe('today');
  expect(iconFor('plus')).toBe('add');
  expect(iconFor('no-such-icon')).toBe('more');
  for (const n of ['link', 'funnel', 'trend', 'tag', 'folder', 'pulse', 'search-check', 'clipboard', 'user-plus', 'key-people']) expect(ICON_NAMES).toContain(n);
});

// The server repo next to this one (skipped on the app's own CI): its real menu for every role.
const serverFile = require('path').resolve(__dirname, '../../../../WehdatHub-Server/lib/navSpec.js');
const live = require('fs').existsSync(serverFile) ? describe : describe.skip;
live('matches the server menu', () => {
  const spec = () => require(serverFile) as { forBroker: (b: unknown, o?: unknown) => Nav; iconNames: () => string[] };
  const who = (role: string) => ({ id: 'b1', role, agency_id: 'a' });

  test('every icon the server menu names is in the app', () => {
    for (const name of spec().iconNames()) expect(ICON_NAMES).toContain(iconFor(name));
  });
  test('each role centres Search, including restricted Data Entry', () => {
    for (const role of ['broker', 'team_lead', 'manager', 'owner', 'data_entry']) {
      for (const owners of [true, false]) {
        const rights = { ...base, owners, dataEntry: role === 'data_entry' };
        const nav = spec().forBroker(who(role), { rights });
        const p = tabPlan(nav, rights);
        expect(p.initial).toBe('Search');
        expect(p.tabs.length % 2).toBe(1);
        expect(p.tabs[Math.floor(p.tabs.length / 2)]).toMatchObject({ key: 'Search', icon: 'search', fab: true });
        expect(p.tabs.filter((t) => t.fab)).toHaveLength(1);
        for (const tab of nav.tabs.filter((entry) => entry.app && entry.app !== 'Today')) {
          expect(p.tabs.some((item) => item.key === tab.app)).toBe(true);
        }
      }
    }
  });
  test('broker and team lead bars open on Search and Add is the first row of More', () => {
    for (const role of ['broker', 'team_lead']) {
      expect(tabPlan(spec().forBroker(who(role)), base).initial).toBe('Search');
      const rows = (moreSections(spec().forBroker(who(role)), base) ?? []).flatMap((g) => g.rows);
      expect(rows[0]).toMatchObject({ id: 'add', screen: 'AddUnit' });
    }
  });
  test('the More list per role has rows with Arabic and English text and a screen', () => {
    for (const role of ['broker', 'team_lead', 'manager', 'owner', 'data_entry']) {
      const nav = spec().forBroker(who(role));
      const sections = moreSections(nav, { ...base, dataEntry: role === 'data_entry' }) ?? [];
      for (const g of sections) for (const r of g.rows) expect([role, r.id, Boolean(r.label.ar && r.label.en && r.screen)]).toEqual([role, r.id, true]);
    }
    const dataEntryRows = (moreSections(spec().forBroker(who('data_entry')), { ...base, dataEntry: true }) ?? []).flatMap((g) => g.rows.map((r) => r.id));
    for (const hidden of ['leases', 'projects', 'inbox']) expect(dataEntryRows).not.toContain(hidden);
    const brokerRows = (moreSections(spec().forBroker(who('broker')), base) ?? []).flatMap((g) => g.rows.map((r) => r.id));
    for (const shown of ['leases', 'projects', 'inbox', 'usage']) expect(brokerRows).toContain(shown);
  });
});

describe('AI use card (read only)', () => {
  const ai = (over: Partial<AiUsage>): AiUsage => ({ mode: 'pool', defaultCredits: null, managerCanEdit: false, canEdit: false, mine: { allowance: null, used: 7, remaining: null }, ...over });

  test('pool mode: the use only, from the shared pool', async () => {
    await render(<AiUsageCard ai={ai({})} ar={false} />);
    expect(screen.getByTestId('ai-own-pool').props.children).toMatch(/You used 7 this month, from the agency's shared pool/);
    expect(screen.queryByTestId('ai-own-limit')).toBeNull();
  });

  test('limit mode: "Your AI limit: X this month, used Y"', async () => {
    await render(<AiUsageCard ai={ai({ mode: 'per_user', mine: { allowance: 30, used: 12, remaining: 18 } })} ar={false} />);
    expect(screen.getByTestId('ai-own-limit').props.children).toMatch(/Your AI limit: 30 this month, used 12/);
    expect(screen.getByTestId('meter-ai-own')).toBeTruthy();
  });

  test('limit mode with no personal limit says so', async () => {
    await render(<AiUsageCard ai={ai({ mode: 'per_user' })} ar={false} />);
    expect(screen.getByTestId('ai-own-none')).toBeTruthy();
  });

  test('managers see everyone, read only, with the owner line when they may not edit', async () => {
    await render(<AiUsageCard ai={ai({ mode: 'per_user', people: [{ id: 'p1', name: 'Sara', role: 'broker', override: null, allowance: 20, used: 5 }] })} ar={false} />);
    expect(screen.getByTestId('ai-people')).toBeTruthy();
    expect(screen.getByText(/The agency owner has not allowed managers to change this/)).toBeTruthy();
  });
});
