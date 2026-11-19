import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WhatsAppImportScreen } from '../src/screens/WhatsAppImportScreen';
import { api } from '../src/api';
import { openChat, readChat } from '../src/zipImport';

jest.mock('../src/api', () => ({ api: { codeCheck: jest.fn(), chatRead: jest.fn(), reviewUnit: jest.fn(), createUnit: jest.fn(), photoUploadLinks: jest.fn(), unitSaveStatus: jest.fn(), unitEditFields: jest.fn(), saveUnitEdit: jest.fn(), unitPhotos: jest.fn() } }));
jest.mock('../src/zipImport', () => {
  class ZipImportError extends Error { reason: string; constructor(reason: string) { super(reason); this.reason = reason; } }
  return { ZipImportError, openChat: jest.fn(), readChat: jest.fn(), cancelUnpack: jest.fn(), cleanUp: jest.fn() };
});
jest.mock('../src/usage', () => ({ usage: jest.fn() }));
jest.mock('../src/errorReport', () => ({ reportError: jest.fn() }));
jest.mock('../src/photoUpload', () => ({ uploadPhoto: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/rights', () => ({ useRights: () => ({ manager: true, agencyOwner: false, dataEntry: false, addUnits: true }) }));
jest.mock('../src/components/SmartImage', () => ({ SmartImage: () => null }));
const mockAddListener = jest.fn((_ev: string, _fn: unknown) => jest.fn());
const mockZip = { uri: 'file:///cache/chat.zip', name: 'chat.zip', type: 'application/zip' };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), replace: jest.fn(), dispatch: jest.fn(), addListener: mockAddListener }),
  useRoute: () => ({ params: { zip: mockZip } }),
}));

const m = api as unknown as Record<string, jest.Mock>;
const opened = { zipPath: '/cache/chat.zip', chatText: '', info: { firstAt: Date.UTC(2026, 8, 1), lastAt: Date.UTC(2026, 9, 24), total: 120, perDay: { '2026-10-24': 10, '2026-10-01': 5, '2026-09-01': 3 }, fingerprint: 'fpR' }, close: jest.fn().mockResolvedValue(undefined) };
const post = (i: number, code: string, photos: number, at = '24/10/2026 10:15') => ({
  i, sender: 'Ahmed', at, text: `شقة للبيع ${code} 150 متر 01012345678`, code, over: 0, videos: 0, verify: false,
  files: Array.from({ length: photos }, (_, k) => ({ name: `IMG-${i}-${k}.jpg`, i: i + k, at: null })),
});
const chatRead = (over: Record<string, unknown> = {}) => ({ listing_type: 'sale', property_type: 'apartment', compound: 'Hyde Park', price_value: '9500000', area_value: '150', bedrooms: '3', owner_phone: '01012345678', market: 'resale', is_ready: false, feature: [], notes: 'WhatsApp', clean_summary: 'new text', ...over });
let posts: ReturnType<typeof post>[];
import { applyMemory, capMemory, diffDecisions, fingerprintOf, load, MEMORY_CAP, postFingerprint, record, restore } from '../src/whatsappImportMemory';
import { buildImportPosts } from '../src/whatsappImport';

const store = AsyncStorage as unknown as { removeItem: (k: string) => Promise<void>; getItem: (k: string) => Promise<string | null>; setItem: (k: string, v: string) => Promise<void> };
const MEM_KEY = 'wa_import_mem:me:fpR';

beforeEach(async () => {
  jest.clearAllMocks();
  await store.removeItem(MEM_KEY);
  await store.removeItem('wa_import_wm:me:fpR');
  posts = [post(1, 'HP-1', 5), post(2, 'HP-3', 1, '25/10/2026 09:00')];
  (openChat as jest.Mock).mockResolvedValue(opened);
  (readChat as jest.Mock).mockImplementation(async () => {
    const present = new Map<string, string>();
    posts.forEach((p) => p.files.forEach((f) => present.set(f.name.toLowerCase(), f.name)));
    return { dir: '/cache/wa', posts, present, skipped: 0, missing: 0, stats: { truncated: 0 } };
  });
  m.codeCheck.mockResolvedValue({ codes: { 'HP-1': { state: 'new' }, 'HP-3': { state: 'new' } }, max_photos: 15, ai_cost: 0 });
  m.chatRead.mockImplementation(async (texts: string[]) => ({ posts: texts.map((_, k) => ({ fields: chatRead({ code: `HP-${k}` }), missing: [] })) }));
  m.reviewUnit.mockResolvedValue({ ok: true, blockers: [], warnings: [], duplicate: null });
  m.photoUploadLinks.mockImplementation(async (n: number) => ({ uploads: Array.from({ length: n }, (_, k) => ({ key: `k${k}`, upload_url: 'u', thumb_key: 't', thumb_upload_url: null })) }));
  m.createUnit.mockResolvedValue({ code: 'HP-1', photos: 1, photosFailed: 0 });
});

const open = async () => {
  await act(async () => { render(<WhatsAppImportScreen />); });
  await waitFor(() => expect(screen.getByTestId('wa-range-read')).toBeTruthy());
  await act(async () => { fireEvent.press(screen.getByTestId('wa-range-read')); });
  await waitFor(() => expect(screen.getByTestId('wa-summary')).toBeTruthy());
};
const mem = async () => (JSON.parse((await store.getItem(MEM_KEY)) || '{}') as { m?: Record<string, { o: string }> }).m ?? {};
const settle = async (check: () => Promise<void>) => { await act(async () => { for (let i = 0; i < 40; i += 1) { try { await check(); return; } catch (e) { if (i === 39) throw e; await new Promise<void>((r) => setTimeout(r, 50)); } } }); };
const fpOf = (i: number) => fingerprintOf(posts[i - 1] as never);

describe('post fingerprint, cap, apply and the storage interface', () => {
  test('stable for the same sender, time and wording (spacing and Arabic letter variants folded), different otherwise', () => {
    const t = Date.UTC(2026, 9, 24, 10, 15);
    const a = postFingerprint('Ahmed', t, 'شقة  للبيع');
    expect(postFingerprint('Ahmed', t, 'شقة  للبيع')).toBe(a);
    expect(postFingerprint('Ahmed', t, ' شقه للبيع ')).toBe(a);
    expect(postFingerprint('Ahmed', t + 60000, 'شقة  للبيع')).not.toBe(a);
    expect(postFingerprint('Omar', t, 'شقة  للبيع')).not.toBe(a);
    expect(a).toMatch(/^[0-9a-z]+$/);
  });

  test('the cap keeps the newest entries', () => {
    const big: Record<string, { o: 'saved'; at: number }> = {};
    for (let i = 0; i < MEMORY_CAP + 50; i += 1) big[`k${i}`] = { o: 'saved', at: i };
    const out = capMemory(big);
    expect(Object.keys(out)).toHaveLength(MEMORY_CAP);
    expect(out.k0).toBeUndefined();
    expect(out[`k${MEMORY_CAP + 49}`]).toBeTruthy();
  });

  test('outcomes are applied: saved leaves the list, discarded stays discarded, unchanged is unticked', () => {
    const present = new Map(posts.flatMap((p) => p.files.map((f) => [f.name.toLowerCase(), f.name] as [string, string])));
    const list = buildImportPosts(posts as never, '/d', present);
    const r = applyMemory(list, { [fingerprintOf(list[0].post)]: { o: 'saved', at: 1 }, [fingerprintOf(list[1].post)]: { o: 'discarded', at: 1 } });
    expect(r.priorSaved.map((p) => p.id)).toEqual(['1']);
    expect(r.list[0]).toMatchObject({ id: '2', discarded: true, picked: false });
    const r2 = applyMemory(list, { [fingerprintOf(list[0].post)]: { o: 'unchanged', at: 1 } });
    expect(r2.list[0].picked).toBe(false);
    expect(r2.list[1].picked).toBe(true);
  });

  test('a restored discard shows as cleared in the diff', () => {
    const r = diffDecisions({ a: { o: 'discarded', at: 1 } }, [{ pfp: 'a', outcome: null }]);
    expect(r.cleared).toEqual(['a']);
    expect(r.mem.a).toBeUndefined();
  });

  test('load / record / restore round trip, and the cap holds in storage', async () => {
    await record('fpX', [{ pfp: 'a', outcome: 'saved' }, { pfp: 'b', outcome: 'discarded' }], 5);
    const l = await load('fpX');
    expect(l.decisions.a.o).toBe('saved');
    expect(l.lastImportAt).toBe(5);
    await restore('fpX', ['b']);
    expect((await load('fpX')).decisions.b).toBeUndefined();
    await record('fpX', Array.from({ length: MEMORY_CAP + 10 }, (_, i) => ({ pfp: `z${i}`, outcome: 'unchanged' as const })), 9);
    expect(Object.keys((await load('fpX')).decisions)).toHaveLength(MEMORY_CAP);
  });
});

describe('the screen remembers decisions', () => {
  test('a discard is stored; re-importing shows it discarded earlier; restore one clears it in storage and ticks it', async () => {
    await open();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-discard-2')); });
    await settle(async () => expect((await mem())[fpOf(2)]?.o).toBe('discarded'));
    await cleanup();
    await open();
    expect(screen.queryByTestId('wa-post-2')).toBeNull();
    expect(screen.getByTestId('wa-post-1')).toBeTruthy();
    expect(screen.getByTestId('wa-earlier-line')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText(/^(1 discarded|1 بوست متجاهل)$/)); });
    await act(async () => { fireEvent.press(screen.getByTestId('wa-restore-2')); });
    expect(screen.getByTestId('wa-pick-2').props.accessibilityState.checked).toBe(true);
    await settle(async () => expect((await mem())[fpOf(2)]).toBeUndefined());
  });

  test('restore all clears every remembered discard', async () => {
    await open();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-discard-1')); });
    await act(async () => { fireEvent.press(screen.getByTestId('wa-discard-2')); });
    await settle(async () => expect(Object.keys(await mem())).toHaveLength(2));
    await cleanup();
    await open();
    expect(screen.queryByTestId('wa-post-1')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-restore-all')); });
    expect(screen.getByTestId('wa-post-1')).toBeTruthy();
    await settle(async () => expect(Object.keys(await mem())).toHaveLength(0));
  });

  test('saved posts are hidden on re-import with a line and a Show toggle; forget clears the memory', async () => {
    await open();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); });
    await waitFor(() => expect(screen.getByTestId('wa-result')).toBeTruthy());
    await settle(async () => expect(Object.values(await mem()).filter((v) => v.o === 'saved')).toHaveLength(2));
    await cleanup();
    await open();
    expect(screen.queryByTestId('wa-post-1')).toBeNull();
    expect(screen.getByTestId('wa-prior-line').props.children).toMatch(/2/);
    await act(async () => { fireEvent.press(screen.getByTestId('wa-prior-toggle')); });
    await act(async () => { fireEvent.press(screen.getByTestId('wa-bring-1')); });
    expect(screen.getByTestId('wa-post-1')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-forget')); });
    expect(screen.getByTestId('wa-forgot-note')).toBeTruthy();
    expect(await store.getItem(MEM_KEY)).toBeNull();
  });
});
