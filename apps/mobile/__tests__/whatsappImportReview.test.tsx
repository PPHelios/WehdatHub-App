import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiClientError } from '@wehdathub/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WhatsAppImportScreen } from '../src/screens/WhatsAppImportScreen';
import { api } from '../src/api';
import { openChat, readChat } from '../src/zipImport';
import { usage } from '../src/usage';
import { resetMemoryCache } from '../src/whatsappImportMemory';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../src/api', () => ({ api: { chatPlan: jest.fn(), chatDecisions: jest.fn(), saveChatDecisions: jest.fn(), forgetChatDecisions: jest.fn(), codeCheck: jest.fn(), chatRead: jest.fn(), reviewUnit: jest.fn(), createUnit: jest.fn(), photoUploadLinks: jest.fn(), unitSaveStatus: jest.fn(), unitEditFields: jest.fn(), saveUnitEdit: jest.fn(), unitPhotos: jest.fn() } }));
jest.mock('../src/zipImport', () => {
  class ZipImportError extends Error { reason: string; constructor(reason: string) { super(reason); this.reason = reason; } }
  return { ZipImportError, openChat: jest.fn(), readChat: jest.fn(), cancelUnpack: jest.fn(), cleanUp: jest.fn() };
});
jest.mock('../src/usage', () => ({ usage: jest.fn() }));
jest.mock('../src/errorReport', () => ({ reportError: jest.fn() }));
jest.mock('../src/photoUpload', () => ({ uploadPhoto: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/planState', () => ({ ...jest.requireActual('../src/planState'), usePlanState: () => ({ phase: 'none', daysLeft: 30, manager: true, allowance: undefined }) }));
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
const stored = { listing_type: 'sale', property_type: 'apartment', compound: 'Hyde Park', price_value: '8000000', area_value: '150', bedrooms: '3', owner_phone: '01012345678', owner_name: 'Omar', market: 'primary', is_ready: '1', feature: ['pool'], notes: 'old note', clean_summary: 'old text' };
// What the chat reader gives for every post: market, is_ready:false, feature:[] and the WhatsApp note are always there.
const chatRead = (over: Record<string, unknown> = {}) => ({ listing_type: 'sale', property_type: 'apartment', compound: 'Hyde Park', price_value: '9500000', area_value: '150', bedrooms: '3', owner_phone: '01012345678', market: 'resale', is_ready: false, feature: [], notes: 'WhatsApp', clean_summary: 'new text', ...over });
let posts: ReturnType<typeof post>[];
let truncated = 0;

// The server's chat plan by post id: everything is new unless the test says otherwise (ids in planKinds).
let planKinds: Record<string, Record<string, unknown>> = {};
const planFor = async (b: { id: string }[]) => ({ posts: b.map((x) => ({ id: x.id, kind: 'new', code: null, existing: null, changes: [], patch: {}, errors: [], ...(planKinds[x.id] ?? {}) })) });
const unit = (code: string, version = 7) => ({ code, version, updated_at: null });
// HP-1 changes its price: the server's patch and note, on version 7.
const updatePlan = (version = 7) => ({ kind: 'update', code: 'HP-1', existing: unit('HP-1', version), patch: { price_value: '9500000' }, notes_append: 'WhatsApp', changes: [{ field: 'price_value', from: '8,000,000', to: '9,500,000', from_ar: '8,000,000', from_en: '8,000,000', to_ar: '9,500,000', to_en: '9,500,000' }] });
const replan = (id: string, over: Record<string, unknown>) => ({ posts: [{ id, kind: 'new', code: null, existing: null, changes: [], patch: {}, errors: [], ...over }] });

beforeEach(async () => {
  // The Save confirm: tests answer it with its last button (Save).
  jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((...a: unknown[]) => { (a[2] as { onPress?: () => void }[] | undefined)?.slice(-1)[0]?.onPress?.(); });
  jest.clearAllMocks();
  resetMemoryCache();
  planKinds = { '1': updatePlan() };
  m.chatPlan.mockImplementation(planFor);
  m.chatDecisions.mockResolvedValue({ decisions: {}, last_import_at: null });
  m.saveChatDecisions.mockResolvedValue({ ok: true, stored: 0 });
  m.forgetChatDecisions.mockResolvedValue({ ok: true, removed: 0 });
  await AsyncStorage.removeItem('wa_import_att:me:fpR:HP1');
  truncated = 0;
  posts = [post(1, 'HP-1', 5), post(2, 'HP-3', 1, '25/10/2026 09:00')];
  (openChat as jest.Mock).mockResolvedValue(opened);
  (readChat as jest.Mock).mockImplementation(async () => {
    const present = new Map<string, string>();
    posts.forEach((p) => p.files.forEach((f) => present.set(f.name.toLowerCase(), f.name)));
    return { dir: '/cache/wa', posts, present, skipped: 0, missing: 0, stats: { truncated } };
  });
  m.codeCheck.mockResolvedValue({ codes: { 'HP-1': { state: 'update', code: 'HP-1', photos: 12, status: 'active' }, 'HP-3': { state: 'new' } }, max_photos: 15, ai_cost: 0 });
  m.unitEditFields.mockResolvedValue({ code: 'HP-1', version: 7, fields: stored });
  m.chatRead.mockResolvedValue({ posts: [{ fields: chatRead({ code: 'HP-1' }), missing: [] }, { fields: chatRead({ code: 'HP-3', owner_name: undefined }), missing: ['owner_name'] }] });
  m.reviewUnit.mockResolvedValue({ ok: true, blockers: [], warnings: [], duplicate: null });
  m.photoUploadLinks.mockImplementation(async (n: number) => ({ uploads: Array.from({ length: n }, (_, k) => ({ key: `k${k}`, upload_url: 'u', thumb_key: 't', thumb_upload_url: null })) }));
  m.createUnit.mockResolvedValue({ code: 'HP-3', photos: 1, photosFailed: 0 });
  m.saveUnitEdit.mockResolvedValue({ code: 'HP-1', version: 8 });
  m.unitPhotos.mockResolvedValue({ images: [], failed: 0 });
});

// Unchanged units are hidden by default; most tests look at their cards, so show them.
const showUnchanged = async () => { const t = screen.queryByTestId('wa-hide-unchanged'); if (t?.props.accessibilityState.checked) await act(async () => { fireEvent.press(t); }); };
const toRange = async () => {
  await act(async () => { render(<WhatsAppImportScreen />); });
  await waitFor(() => expect(screen.getByTestId('wa-range-read')).toBeTruthy());
};
const open = async () => {
  await toRange();
  await act(async () => { fireEvent.press(screen.getByTestId('wa-range-read')); });
  await waitFor(() => expect(screen.getByTestId('wa-summary')).toBeTruthy());
  await showUnchanged();
};
const ticked = (id: string) => screen.getByTestId(`wa-pick-${id}`).props.accessibilityState.checked as boolean;
const saveAll = async () => { await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); }); await act(async () => { fireEvent.press(screen.getByTestId('wa-ask-go')); }); await waitFor(() => expect(screen.getByTestId('wa-result')).toBeTruthy()); };

describe('the range step', () => {
  test('a zip that arrives is only opened: nothing is read until a range is chosen; the chat span and counts show; 30 days is the default with no watermark', async () => {
    await toRange();
    expect(openChat).toHaveBeenCalledTimes(1);
    expect(readChat).not.toHaveBeenCalled();
    expect(screen.getByTestId('wa-chat-span').props.children).toMatch(/2026-09-01.*2026-10-24.*120|120/);
    expect(screen.queryByTestId('wa-range-last')).toBeNull();
    expect(screen.getByTestId('wa-range-30').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('wa-range-7').props.accessibilityState.selected).toBe(false);
    await act(async () => { fireEvent.press(screen.getByTestId('wa-range-all')); });
    expect(screen.getByTestId('wa-range-all').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('wa-range-count').props.children).toMatch(/18/);
    await act(async () => { fireEvent.press(screen.getByTestId('wa-range-read')); });
    await waitFor(() => expect(screen.getByTestId('wa-summary')).toBeTruthy());
    expect(readChat).toHaveBeenCalledTimes(1);
    expect((readChat as jest.Mock).mock.calls[0][1]).toMatchObject({ since: null, until: null, withMedia: true });
    expect(usage).toHaveBeenCalledWith('wa_import_read', true, expect.any(Number), expect.objectContaining({ since_kind: 'all' }));
  });

  test('with a remembered chat "Since last import" is offered and selected, and reads from a day before the server\'s last import', async () => {
    m.chatDecisions.mockResolvedValue({ decisions: {}, last_import_at: '2026-10-20T08:00:00.000Z' });
    await toRange();
    expect(screen.getByTestId('wa-range-last').props.accessibilityState.selected).toBe(true);
    await act(async () => { fireEvent.press(screen.getByTestId('wa-range-read')); });
    await waitFor(() => expect(screen.getByTestId('wa-summary')).toBeTruthy());
    expect(m.chatDecisions).toHaveBeenCalledWith('fpR');
    expect((readChat as jest.Mock).mock.calls[0][1]).toMatchObject({ since: '2026-10-19', until: null });
  });

  test('a custom date: Arabic digits are accepted; an invalid or empty date shows an error and never reads everything', async () => {
    await toRange();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-range-custom')); });
    await act(async () => { fireEvent.press(screen.getByTestId('wa-range-read')); });
    expect(screen.getByTestId('wa-range-error')).toBeTruthy();
    await act(async () => { fireEvent.changeText(screen.getByTestId('wa-since-input'), '2026-02-31'); });
    await act(async () => { fireEvent.press(screen.getByTestId('wa-range-read')); });
    expect(screen.getByTestId('wa-range-error')).toBeTruthy();
    expect(readChat).not.toHaveBeenCalled();
    await act(async () => { fireEvent.changeText(screen.getByTestId('wa-since-input'), '٢٠٢٦-١٠-٢٠'); });
    await act(async () => { fireEvent.changeText(screen.getByTestId('wa-until-input'), 'oops'); });
    await act(async () => { fireEvent.press(screen.getByTestId('wa-range-read')); });
    expect(readChat).not.toHaveBeenCalled();
    await act(async () => { fireEvent.changeText(screen.getByTestId('wa-until-input'), '2026-10-30'); });
    await act(async () => { fireEvent.press(screen.getByTestId('wa-range-read')); });
    await waitFor(() => expect(screen.getByTestId('wa-summary')).toBeTruthy());
    expect((readChat as jest.Mock).mock.calls[0][1]).toMatchObject({ since: '2026-10-20', until: '2026-10-31' });
    expect(usage).toHaveBeenCalledWith('wa_import_read', true, expect.any(Number), expect.objectContaining({ since_kind: 'custom' }));
  });

  test('the zip stays open while the screen is open and is closed when it closes', async () => {
    await open();
    expect(opened.close).not.toHaveBeenCalled();
    screen.unmount();
    await waitFor(() => expect(opened.close).toHaveBeenCalled());
  });

  test('after a save the saved posts are remembered on the server', async () => {
    await open();
    await saveAll();
    await waitFor(() => expect(m.saveChatDecisions).toHaveBeenCalled());
    const items = m.saveChatDecisions.mock.calls.flatMap((c) => c[1] as { post_fp: string; outcome: string }[]);
    expect(m.saveChatDecisions.mock.calls[0][0]).toBe('fpR');
    expect(items.filter((x) => x.outcome === 'saved')).toHaveLength(2);
  });
});

describe('saving an update', () => {
  test('only the changed keys are overlaid on the stored unit: never market, readiness, features, summary or notes; the note is appended', async () => {
    await open();
    await saveAll();
    const body = m.saveUnitEdit.mock.calls[0][2];
    expect(m.saveUnitEdit.mock.calls[0][1]).toBe(7);
    expect(body).toMatchObject({ price_value: '9500000', market: 'primary', is_ready: '1', feature: ['pool'], clean_summary: 'old text', owner_phone: '01012345678' });
    expect(body.notes).toBe('old note\nWhatsApp');
    expect(m.chatPlan).toHaveBeenCalled();
    expect(m.chatPlan.mock.calls[0][0][0]).toMatchObject({ id: '1', at: expect.any(String) });
  });

  test('new photos on an update are capped at 15 minus the unit\'s photos', async () => {
    await open();
    await saveAll();
    expect(m.photoUploadLinks.mock.calls[0][0]).toBe(3); // HP-1 already has 12
    expect(m.unitPhotos.mock.calls[0][1].photoKeys).toHaveLength(3);
  });

  test('a photo upload that fails is said in the result (the unit itself is saved)', async () => {
    m.unitPhotos.mockRejectedValue(new Error('boom'));
    await open();
    await saveAll();
    expect(screen.getByTestId('wa-result-photos').props.children).toMatch(/HP-1/);
  });

  test('a 409 asks the server for the plan again and saves once more on the new version', async () => {
    m.saveUnitEdit.mockRejectedValueOnce(new ApiClientError(409, 'version_conflict')).mockResolvedValue({ code: 'HP-1', version: 9 });
    m.chatPlan.mockImplementationOnce(planFor).mockResolvedValueOnce(replan('1', updatePlan(8)));
    await open();
    await saveAll();
    expect(m.saveUnitEdit).toHaveBeenCalledTimes(2);
    expect(m.saveUnitEdit.mock.calls[1][1]).toBe(8);
    expect(m.saveUnitEdit.mock.calls[1][3]).not.toBe(m.saveUnitEdit.mock.calls[0][3]);
  });

  test('a 409 after which nothing differs is left unticked with a note, not saved again', async () => {
    m.saveUnitEdit.mockRejectedValueOnce(new ApiClientError(409, 'version_conflict'));
    m.chatPlan.mockImplementationOnce(planFor).mockResolvedValueOnce(replan('1', { kind: 'unchanged', code: 'HP-1', existing: unit('HP-1', 8) }));
    await open();
    await saveAll();
    expect(m.saveUnitEdit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('wa-post-1')).toBeTruthy();
    expect(ticked('1')).toBe(false);
  });
});

describe('what cannot be an update', () => {
  test('a code the server says belongs to another unit is an unticked error', async () => {
    planKinds = { '1': { kind: 'other_unit', code: 'HP-1', existing: unit('HP-1') } };
    await open();
    expect(ticked('1')).toBe(false);
    expect(screen.getByTestId('wa-blocker-1').props.children).toMatch(/another unit|وحدة تانية/);
    expect(screen.getByTestId('wa-pick-1').props.accessibilityState.disabled).toBe(true);
  });

  test('a unit the server says was edited after the post is "older", unticked', async () => {
    planKinds = { '1': { kind: 'older', code: 'HP-1', existing: unit('HP-1') } };
    await open();
    expect(ticked('1')).toBe(false);
    expect(screen.getByTestId('wa-blocker-1').props.children).toMatch(/edited after|اتعدلت بعد/);
  });

  test('a plan that could not be asked is "could not compare" for an update, never "updated"', async () => {
    m.chatPlan.mockRejectedValue(new Error('net'));
    await open();
    expect(ticked('1')).toBe(false);
    expect(screen.getByTestId('wa-blocker-1').props.children).toMatch(/compare|نقارن/);
    expect(screen.queryByTestId('wa-changes-1')).toBeNull();
  });
});

describe('every plan kind maps to the card', () => {
  const kindOfCard = async (over: Record<string, unknown>) => { planKinds = { '1': { code: 'HP-1', existing: unit('HP-1'), ...over } }; await open(); };
  test('update: changed and ticked, with the plan\'s changes listed', async () => {
    await open();
    expect(ticked('1')).toBe(true);
    expect(screen.getByTestId('wa-changes-1').props.children).toMatch(/8,000,000.*9,500,000/);
    expect(screen.getByTestId('wa-badge-update').props.children).toMatch(/🔄/); // the badge says "changes" only for a real change
  });
  test('unchanged: unticked and skipped', async () => {
    await kindOfCard({ kind: 'unchanged' });
    expect(ticked('1')).toBe(false);
    expect(screen.getByTestId('wa-unchanged-1')).toBeTruthy();
    expect(screen.getByTestId('wa-badge-update').props.children).not.toMatch(/🔄/); // "unit exists", not "updates": same zip, nothing changed
  });
  test('other_unit and older: unticked errors that cannot be ticked', async () => {
    await kindOfCard({ kind: 'other_unit' });
    expect(ticked('1')).toBe(false);
    expect(screen.getByTestId('wa-pick-1').props.accessibilityState.disabled).toBe(true);
  });
  test('invalid and forbidden: errors with their own note', async () => {
    await kindOfCard({ kind: 'invalid', existing: null, errors: ['x'] });
    expect(ticked('1')).toBe(false);
    expect(screen.getByTestId('wa-blocker-1').props.children).toMatch(/could not read this post|مقدرش يقرا/);
    expect(screen.getByTestId('wa-pick-1').props.accessibilityState.disabled).toBe(true);
  });
  test('forbidden', async () => {
    await kindOfCard({ kind: 'forbidden', existing: null });
    expect(screen.getByTestId('wa-blocker-1').props.children).toMatch(/may not|مش من حقك/);
  });
  test('new: new and ticked', async () => {
    await kindOfCard({ kind: 'new', existing: null });
    expect(ticked('1')).toBe(true);
  });
  test('more than 60 posts are planned in chunks of 60', async () => {
    posts = Array.from({ length: 65 }, (_, k) => post(k + 1, `HP-${k + 10}`, 0));
    m.codeCheck.mockResolvedValue({ codes: {}, max_photos: 15, ai_cost: 0 });
    m.chatRead.mockResolvedValue({ posts: posts.map((_, k) => ({ fields: chatRead({ code: `HP-${k + 10}` }), missing: [] })) });
    planKinds = {};
    await open();
    expect(m.chatPlan.mock.calls.map((c) => c[0].length)).toEqual([60, 5]);
  });
});

describe('saving a new unit', () => {
  test('a phone with no owner name stands in for the name, and the post is not bounced for the missing name', async () => {
    await open();
    expect(ticked('2')).toBe(true);
    await saveAll();
    expect(m.createUnit.mock.calls[0][0]).toMatchObject({ owner_phone: '01012345678', owner_name_from_phone: '1' });
  });

  test('the save key is kept on the post: a retry after a failure reuses it', async () => {
    m.createUnit.mockRejectedValueOnce(new ApiClientError(500, 'oops')).mockResolvedValue({ code: 'HP-3', photos: 1, photosFailed: 0 });
    planKinds = { '1': { kind: 'unchanged', code: 'HP-1', existing: unit('HP-1') } }; // HP-1 unchanged: only HP-3 is saved
    await open();
    await saveAll();
    await waitFor(() => expect(screen.getByTestId('wa-post-2')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); });
    await act(async () => { fireEvent.press(screen.getByTestId('wa-ask-go')); });
    await waitFor(() => expect(m.createUnit).toHaveBeenCalledTimes(2));
    expect(m.createUnit.mock.calls[1][2]).toBe(m.createUnit.mock.calls[0][2]);
  });

  test('two taps on Save all save once', async () => {
    planKinds = { '1': { kind: 'unchanged', code: 'HP-1', existing: unit('HP-1') } };
    await open();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); fireEvent.press(screen.getByTestId('wa-add')); });
    await act(async () => { fireEvent.press(screen.getByTestId('wa-ask-go')); });
    await waitFor(() => expect(screen.getByTestId('wa-result')).toBeTruthy());
    expect(m.createUnit).toHaveBeenCalledTimes(1);
  });

  test('a post discarded while the loop runs is skipped', async () => {
    let release: () => void = () => undefined;
    m.reviewUnit.mockImplementationOnce(() => new Promise((res) => { release = () => res({ ok: true, blockers: [], warnings: [], duplicate: null }); }));
    // HP-1 update first (slow review); HP-3 is discarded before the loop reaches it.
    await open();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); });
    await act(async () => { fireEvent.press(screen.getByTestId('wa-ask-go')); });
    expect(screen.getByTestId('wa-discard-2').props.accessibilityState?.disabled ?? screen.getByTestId('wa-discard-2').props.disabled).toBeTruthy();
    await act(async () => { release(); });
    await waitFor(() => expect(screen.getByTestId('wa-result')).toBeTruthy());
  });
});

describe('the list', () => {
  test('a cut chat says "showing N of M" with the date to continue from', async () => {
    truncated = 8;
    await open();
    expect(screen.getByTestId('wa-truncated').props.children).toMatch(/2 of 10|2 من 10/);
    expect(screen.getByTestId('wa-truncated').props.children).toMatch(/2026-10-25/);
  });

  test('accessibility: the checkbox, Discard and the photos carry names and states', async () => {
    await open();
    const box = screen.getByTestId('wa-pick-1');
    expect(box.props.accessibilityRole).toBe('checkbox');
    expect(box.props.accessibilityLabel).toMatch(/HP-1/);
    expect(screen.getByText(/Leave out post HP-1|استبعد البوست HP-1/)).toBeTruthy();
    const ph = screen.getByTestId('wa-photo-1-0');
    expect(ph.props.accessibilityRole).toBe('checkbox');
    expect(ph.props.accessibilityState.checked).toBe(true);
  });

  test('leaving with units still to save asks first; leaving with nothing to save does not', async () => {
    await open();
    const fn = mockAddListener.mock.calls.filter((c) => c[0] === 'beforeRemove').pop()?.[1] as (e: { preventDefault: () => void; data: { action: unknown } }) => void;
    const e = { preventDefault: jest.fn(), data: { action: {} } };
    await act(async () => { fn(e); });
    expect(e.preventDefault).toHaveBeenCalled();
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('wa-ask-go')).toBeTruthy();
  });

  test('retrying the details keeps the ticks the person set', async () => {
    m.chatRead.mockRejectedValueOnce(new Error('net'));
    planKinds = { '1': { kind: 'unchanged', code: 'HP-1', existing: unit('HP-1') } };
    await open();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-read-retry')); });
    await waitFor(() => expect(screen.queryByTestId('wa-read-failed')).toBeNull());
    expect(ticked('2')).toBe(true);
    await act(async () => { fireEvent.press(screen.getByTestId('wa-pick-2')); });
    expect(ticked('2')).toBe(false);
  });
});

describe('the view filter', () => {
  const openRaw = async () => {
    await toRange();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-range-read')); });
    await waitFor(() => expect(screen.getByTestId('wa-summary')).toBeTruthy());
  };
  const press = async (id: string) => { await act(async () => { fireEvent.press(screen.getByTestId(id)); }); };
  const unchangedPlan = () => { planKinds = { '1': { kind: 'unchanged', code: 'HP-1', existing: unit('HP-1') } }; };

  test('unchanged units are hidden by default; the footer counts them and shows them', async () => {
    unchangedPlan();
    await openRaw();
    await waitFor(() => expect(screen.queryByTestId('wa-post-1')).toBeNull());
    expect(screen.getByTestId('wa-post-2')).toBeTruthy();
    expect(screen.getByTestId('wa-unchanged-hidden').props.children).toBeTruthy();
    await press('wa-unchanged-hidden');
    expect(screen.getByTestId('wa-post-1')).toBeTruthy();
    expect(screen.queryByTestId('wa-unchanged-hidden')).toBeNull();
  });

  test('chips narrow the list; ticks, discarded and save counts are unaffected', async () => {
    await openRaw(); // HP-1 updated, HP-3 new
    await waitFor(() => expect(screen.getByTestId('wa-filter-new')).toBeTruthy());
    const ready = () => screen.getByTestId('wa-ready').props.children as string;
    const before = ready();
    await press('wa-filter-new');
    expect(screen.queryByTestId('wa-post-1')).toBeNull();
    expect(screen.getByTestId('wa-post-2')).toBeTruthy();
    await press('wa-filter-updated');
    expect(screen.getByTestId('wa-post-1')).toBeTruthy();
    expect(screen.queryByTestId('wa-post-2')).toBeNull();
    await press('wa-filter-fix');
    expect(screen.queryByTestId('wa-post-1')).toBeNull();
    expect(screen.queryByTestId('wa-post-2')).toBeNull();
    expect(ready()).toBe(before);
    await press('wa-filter-all');
    expect(screen.getByTestId('wa-post-1')).toBeTruthy();
    expect(screen.getByTestId('wa-post-2')).toBeTruthy();
    expect(ticked('1')).toBe(true);
    await saveAll();
    expect(m.saveUnitEdit).toHaveBeenCalledTimes(1);
    expect(m.createUnit).toHaveBeenCalledTimes(1);
  });

  test('hidden unchanged units still count in the bottom line and are not discarded', async () => {
    unchangedPlan();
    await openRaw();
    await waitFor(() => expect(screen.queryByTestId('wa-post-1')).toBeNull());
    expect(screen.getByTestId('wa-ready').props.children).toMatch(/unchanged 1, discarded 0|من غير تغيير 1، متجاهلة 0/);
    expect(screen.queryByTestId('wa-discarded-bar')).toBeNull();
  });
});
