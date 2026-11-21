import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ChatFingerprint } from '@wehdathub/shared';
import { WhatsAppImportScreen } from '../src/screens/WhatsAppImportScreen';
import { api } from '../src/api';
import { openChat, readChat } from '../src/zipImport';
import { applyMemory, diffDecisions, fingerprintOf, forgetAll, load, MAX_PER_REQUEST, postFingerprint, record, resetMemoryCache, restore } from '../src/whatsappImportMemory';
import { buildImportPosts } from '../src/whatsappImport';

jest.mock('../src/api', () => ({ api: { chatPlan: jest.fn(), chatDecisions: jest.fn(), saveChatDecisions: jest.fn(), forgetChatDecisions: jest.fn(), codeCheck: jest.fn(), chatRead: jest.fn(), reviewUnit: jest.fn(), createUnit: jest.fn(), photoUploadLinks: jest.fn(), unitSaveStatus: jest.fn(), unitEditFields: jest.fn(), saveUnitEdit: jest.fn(), unitPhotos: jest.fn() } }));
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

const iso = (ms: number) => new Date(ms).toISOString();
const planFor = async (b: { id: string }[]) => ({ posts: b.map((x) => ({ id: x.id, kind: 'new', code: null, existing: null, changes: [], patch: {}, errors: [] })) });
const fpOf = (i: number) => fingerprintOf(posts[i - 1] as never);
const remembered = (map: Record<string, string>) => ({ decisions: Object.fromEntries(Object.entries(map).map(([k, o]) => [k, { outcome: o, at: iso(Date.now()) }])), last_import_at: null });

beforeEach(() => {
  // The Save confirm: tests answer it with its last button (Save).
  jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((...a: unknown[]) => { (a[2] as { onPress?: () => void }[] | undefined)?.slice(-1)[0]?.onPress?.(); });
  jest.clearAllMocks();
  resetMemoryCache();
  posts = [post(1, 'HP-1', 5), post(2, 'HP-3', 1, '25/10/2026 09:00')];
  (openChat as jest.Mock).mockResolvedValue(opened);
  (readChat as jest.Mock).mockImplementation(async () => {
    const present = new Map<string, string>();
    posts.forEach((p) => p.files.forEach((f) => present.set(f.name.toLowerCase(), f.name)));
    return { dir: '/cache/wa', posts, present, skipped: 0, missing: 0, stats: { truncated: 0 } };
  });
  m.chatPlan.mockImplementation(planFor);
  m.chatDecisions.mockResolvedValue({ decisions: {}, last_import_at: null });
  m.saveChatDecisions.mockResolvedValue({ ok: true, stored: 0 });
  m.forgetChatDecisions.mockResolvedValue({ ok: true, removed: 0 });
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
// Waits for the debounced write of the screen (and the facade's request) to show up in the mock.
const settle = async (check: () => void) => { await act(async () => { for (let i = 0; i < 40; i += 1) { try { check(); return; } catch (e) { if (i === 39) throw e; await new Promise<void>((r) => setTimeout(r, 50)); } } }); };
const sent = () => m.saveChatDecisions.mock.calls.flatMap((c) => c[1] as { post_fp: string; outcome: string }[]);

describe('post fingerprint, apply and diff', () => {
  test('the fingerprint is the shared one (byte-identical to the website) and stable', () => {
    const t = '24/10/2026 10:15';
    expect(postFingerprint('Ahmed', t, 'شقة  للبيع')).toBe(ChatFingerprint.postFingerprint('Ahmed', t, 'شقة  للبيع'));
    expect(postFingerprint('Ahmed', t, ' شقه للبيع ')).toBe(postFingerprint('Ahmed', t, 'شقة  للبيع'));
    expect(postFingerprint('Ahmed', '24/10/2026 10:16', 'شقة  للبيع')).not.toBe(postFingerprint('Ahmed', t, 'شقة  للبيع'));
    expect(ChatFingerprint.isPostFp(postFingerprint('Ahmed', t, 'x'))).toBe(true);
    expect(fingerprintOf({ sender: 'Ahmed', at: t, text: 'cleaned', orig: 'as written' })).toBe(postFingerprint('Ahmed', t, 'as written'));
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

  test('a restored discard shows as cleared in the diff; a new outcome as set', () => {
    const r = diffDecisions({ a: { o: 'discarded', at: 1 } }, [{ pfp: 'a', outcome: null }, { pfp: 'b', outcome: 'saved' }]);
    expect(r.cleared).toEqual(['a']);
    expect(r.set).toEqual([{ pfp: 'b', outcome: 'saved' }]);
    expect(r.mem.a).toBeUndefined();
  });
});

describe('the server facade', () => {
  test('load maps the server answer and the last import time', async () => {
    m.chatDecisions.mockResolvedValue({ decisions: { a: { outcome: 'saved', at: '2026-10-24T10:00:00.000Z' } }, last_import_at: '2026-10-24T10:00:00.000Z' });
    const r = await load('fpX');
    expect(m.chatDecisions).toHaveBeenCalledWith('fpX');
    expect(r.decisions.a).toEqual({ o: 'saved', at: Date.parse('2026-10-24T10:00:00.000Z') });
    expect(r.lastImportAt).toBe('2026-10-24T10:00:00.000Z');
  });

  test('record sends at most 200 per request', async () => {
    await record('fpX', Array.from({ length: MAX_PER_REQUEST + 30 }, (_, i) => ({ pfp: `p${i}`, outcome: 'unchanged' as const })));
    expect(m.saveChatDecisions.mock.calls.map((c) => c[1].length)).toEqual([200, 30]);
    expect(m.saveChatDecisions.mock.calls[0][0]).toBe('fpX');
    expect(m.saveChatDecisions.mock.calls[0][1][0]).toEqual({ post_fp: 'p0', outcome: 'unchanged' });
  });

  test('restore forgets some posts; forgetAll forgets the chat (no posts given)', async () => {
    await restore('fpX', ['a', 'b']);
    expect(m.forgetChatDecisions).toHaveBeenCalledWith('fpX', ['a', 'b']);
    await forgetAll('fpX');
    expect(m.forgetChatDecisions).toHaveBeenLastCalledWith('fpX');
    expect((await load('fpX')).decisions).toEqual({});
  });

  test('on a network failure nothing throws: the phone keeps the decisions and sends them with the next call', async () => {
    m.saveChatDecisions.mockRejectedValueOnce(new Error('net'));
    await expect(record('fpX', [{ pfp: 'a', outcome: 'discarded' }])).resolves.toBeUndefined();
    m.chatDecisions.mockRejectedValue(new Error('net'));
    const offline = await load('fpX');
    expect(offline.decisions.a.o).toBe('discarded');
    expect(offline.lastImportAt).toBeNull();
    m.forgetChatDecisions.mockRejectedValue(new Error('net'));
    await expect(restore('fpX', ['zz'])).resolves.toBeUndefined();
    await expect(forgetAll('fpY')).resolves.toBeUndefined();
    await record('fpX', [{ pfp: 'b', outcome: 'saved' }]);
    expect(sent().map((x) => x.post_fp)).toEqual(['a', 'a', 'b']);
  });
});

describe('the screen remembers decisions on the server', () => {
  test('a discard is recorded; importing the same zip again shows it discarded earlier; restore one forgets it on the server and ticks the post', async () => {
    await open();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-discard-2')); });
    await settle(() => expect(sent()).toContainEqual({ post_fp: fpOf(2), outcome: 'discarded' }));
    await cleanup();
    resetMemoryCache();
    m.chatDecisions.mockResolvedValue(remembered({ [fpOf(2)]: 'discarded' }));
    await open();
    expect(screen.queryByTestId('wa-post-2')).toBeNull();
    expect(screen.getByTestId('wa-post-1')).toBeTruthy();
    expect(screen.getByTestId('wa-earlier-line')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText(/^(1 discarded|1 بوست مستبعد)$/)); });
    await act(async () => { fireEvent.press(screen.getByTestId('wa-restore-2')); });
    expect(screen.getByTestId('wa-pick-2').props.accessibilityState.checked).toBe(true);
    await settle(() => expect(m.forgetChatDecisions).toHaveBeenCalledWith('fpR', [fpOf(2)]));
  });

  test('restore all forgets every remembered discard', async () => {
    m.chatDecisions.mockResolvedValue(remembered({ [fpOf(1)]: 'discarded', [fpOf(2)]: 'discarded' }));
    await open();
    expect(screen.queryByTestId('wa-post-1')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-restore-all')); });
    expect(screen.getByTestId('wa-post-1')).toBeTruthy();
    await settle(() => expect(m.forgetChatDecisions.mock.calls.flatMap((c) => c[1] as string[]).sort()).toEqual([fpOf(1), fpOf(2)].sort()));
  });

  test('saved posts are recorded; on re-import they are hidden with a line and a Show toggle, and one can be brought back', async () => {
    await open();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); });
    await waitFor(() => expect(screen.getByTestId('wa-result')).toBeTruthy());
    await settle(() => expect(sent().filter((x) => x.outcome === 'saved')).toHaveLength(2));
    await cleanup();
    resetMemoryCache();
    m.chatDecisions.mockResolvedValue(remembered({ [fpOf(1)]: 'saved', [fpOf(2)]: 'saved' }));
    await open();
    expect(screen.queryByTestId('wa-post-1')).toBeNull();
    expect(screen.getByTestId('wa-prior-line').props.children).toMatch(/2/);
    await act(async () => { fireEvent.press(screen.getByTestId('wa-prior-toggle')); });
    await act(async () => { fireEvent.press(screen.getByTestId('wa-bring-1')); });
    expect(screen.getByTestId('wa-post-1')).toBeTruthy();
  });

  test('forget clears the chat on the server', async () => {
    m.chatDecisions.mockResolvedValue(remembered({ [fpOf(2)]: 'discarded' }));
    await open();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-forget')); });
    expect(screen.getByTestId('wa-forgot-note')).toBeTruthy();
    expect(m.forgetChatDecisions).toHaveBeenCalledWith('fpR');
  });

  test('forget asks first: Cancel clears nothing', async () => {
    m.chatDecisions.mockResolvedValue(remembered({ [fpOf(2)]: 'discarded' }));
    const alert = require('react-native').Alert.alert as jest.Mock;
    await open();
    alert.mockImplementationOnce(() => undefined); // the broker taps Cancel
    await act(async () => { fireEvent.press(screen.getByTestId('wa-forget')); });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('wa-forgot-note')).toBeNull();
    expect(m.forgetChatDecisions).not.toHaveBeenCalled();
  });

  test('when the server cannot be reached the screen still opens and works', async () => {
    m.chatDecisions.mockRejectedValue(new Error('net'));
    m.saveChatDecisions.mockRejectedValue(new Error('net'));
    await open();
    expect(screen.getByTestId('wa-post-1')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-discard-2')); });
    expect(screen.queryByTestId('wa-post-2')).toBeNull();
  });
});
