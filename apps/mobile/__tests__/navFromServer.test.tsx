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

const tab = (key: string, app: string, icon: string, en = key, extra = {}) => ({ key, label: { ar: en, en }, icon, web: `/app/${key}`, app, ...extra });
const item = (key: string, app: string | null, icon: string, onBar = false) => ({ key, label: { ar: key, en: key }, icon, web: `/app/${key}`, app, onBar });

/** What the server sends a broker (a trimmed copy of lib/navSpec.js output). */
const broker: Nav = {
  role: 'broker',
  tabs: [tab('home', 'Today', 'home'), tab('search', 'Search', 'search'), tab('add', 'AddUnit', 'plus', 'Add', { fab: true }), tab('leads', 'Leads', 'leads'), tab('units', 'Units', 'units')],
  groups: [
    { key: 'clients', label: { ar: 'العملاء', en: 'Clients' }, items: [item('leads', 'LeadsList', 'leads', true), item('requests', 'ClientRequests', 'clipboard'), item('leases', 'Leases', 'key'), item('inbox', 'Inbox', 'inbox')] },
    { key: 'listings', label: { ar: 'الوحدات', en: 'Listings' }, items: [item('units', 'UnitsList', 'units', true), item('map', 'MapList', 'pin'), item('waimport', 'WhatsAppImport', 'import'), item('import', null, 'import')] },
    { key: 'account', label: { ar: 'حسابي', en: 'Account' }, items: [item('settings', 'Settings', 'settings'), item('notifications', 'Notifications', 'bell'), item('guide', null, 'book')] },
  ],
};
const dataEntry: Nav = {
  role: 'data_entry',
  tabs: [tab('search', 'Search', 'search'), tab('units', 'Units', 'units'), tab('add', 'AddUnit', 'plus', 'Add', { fab: true }), tab('owners', 'Owners', 'key-people'), tab('settings', 'Settings', 'settings')],
  groups: [{ key: 'account', label: { ar: 'حسابي', en: 'Account' }, items: [item('notifications', 'Notifications', 'bell')] }],
};

test('the tabs come from the server, with Add as the centre button and the server labels', () => {
  const p = tabPlan(broker, base);
  expect(p.tabs.map((t) => t.key)).toEqual(['Today', 'Search', 'AddUnit', 'Leads', 'Units']);
  expect(p.tabs[2].label?.en).toBe('Add');
  expect(p.initial).toBe('Today');
  const d = tabPlan(dataEntry, { ...base, dataEntry: true });
  expect(d.tabs.map((t) => t.key)).toEqual(['Search', 'Units', 'AddUnit', 'Owners', 'Settings']);
  expect(d.initial).toBe('Units');
});

test('an old server (no menu) or the product owner keeps the older tabs', () => {
  expect(usableNav(undefined)).toBeNull();
  expect(usableNav({ ...broker, role: 'crm' })).toBeNull();
  expect(tabPlan(undefined, base).tabs.map((t) => t.key)).toEqual(['Search', 'Leads', 'Today', 'Map', 'More']);
  expect(moreSections(undefined, base)).toBeNull();
});

test('More: the server groups in order, only rows the app can open, none repeated from the bar', () => {
  const s = moreSections(broker, base)!;
  expect(s.map((g) => g.key)).toEqual(['clients', 'listings', 'account']);
  const ids = s.flatMap((g) => g.rows.map((r) => r.id));
  expect(ids).toEqual(['requests', 'leases', 'inbox', 'map', 'waimport', 'notifications']);
  expect(ids).not.toContain('leads'); // on the bar
  expect(ids).not.toContain('import'); // a website page, no app screen
  expect(ids).not.toContain('settings'); // no More screen of that name
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
  test('each role gets five tabs with Add in the centre, and every tab opens a screen the app has', () => {
    for (const role of ['broker', 'team_lead', 'manager', 'owner', 'data_entry']) {
      const nav = spec().forBroker(who(role));
      const p = tabPlan(nav, { ...base, dataEntry: role === 'data_entry' });
      expect(p.tabs).toHaveLength(nav.tabs.length);
      expect(p.tabs[2].key).toBe('AddUnit');
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
