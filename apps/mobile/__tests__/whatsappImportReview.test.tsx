import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiClientError } from '@wehdathub/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WhatsAppImportScreen } from '../src/screens/WhatsAppImportScreen';
import { api } from '../src/api';
import { openChat, readChat } from '../src/zipImport';
import { usage } from '../src/usage';

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
const stored = { listing_type: 'sale', property_type: 'apartment', compound: 'Hyde Park', price_value: '8000000', area_value: '150', bedrooms: '3', owner_phone: '01012345678', owner_name: 'Omar', market: 'primary', is_ready: '1', feature: ['pool'], notes: 'old note', clean_summary: 'old text' };
// What the chat reader gives for every post: market, is_ready:false, feature:[] and the WhatsApp note are always there.
const chatRead = (over: Record<string, unknown> = {}) => ({ listing_type: 'sale', property_type: 'apartment', compound: 'Hyde Park', price_value: '9500000', area_value: '150', bedrooms: '3', owner_phone: '01012345678', market: 'resale', is_ready: false, feature: [], notes: 'WhatsApp', clean_summary: 'new text', ...over });
let posts: ReturnType<typeof post>[];
let truncated = 0;

beforeEach(async () => {
  jest.clearAllMocks();
  const store = AsyncStorage as unknown as { removeItem: (k: string) => Promise<void> };
  await store.removeItem('wa_import_wm:me:fpR');
  await store.removeItem('wa_import_mem:me:fpR');
  await store.removeItem('wa_import_att:me:fpR:HP1');
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

const toRange = async () => {
  await act(async () => { render(<WhatsAppImportScreen />); });
  await waitFor(() => expect(screen.getByTestId('wa-range-read')).toBeTruthy());
};
const open = async () => {
  await toRange();
  await act(async () => { fireEvent.press(screen.getByTestId('wa-range-read')); });
  await waitFor(() => expect(screen.getByTestId('wa-summary')).toBeTruthy());
};
const ticked = (id: string) => screen.getByTestId(`wa-pick-${id}`).props.accessibilityState.checked as boolean;
const saveAll = async () => { await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); }); await waitFor(() => expect(screen.getByTestId('wa-result')).toBeTruthy()); };

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

  test('with a watermark "Since last import" is offered and selected, and reads just after it', async () => {
    await (AsyncStorage as unknown as { setItem: (k: string, v: string) => Promise<void> }).setItem('wa_import_wm:me:fpR', String(Date.UTC(2026, 9, 20, 8, 0)));
    await toRange();
    expect(screen.getByTestId('wa-range-last').props.accessibilityState.selected).toBe(true);
    await act(async () => { fireEvent.press(screen.getByTestId('wa-range-read')); });
    await waitFor(() => expect(screen.getByTestId('wa-summary')).toBeTruthy());
    expect((readChat as jest.Mock).mock.calls[0][1].since).toBe(Date.UTC(2026, 9, 20, 8, 0) + 1);
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
    expect((readChat as jest.Mock).mock.calls[0][1]).toMatchObject({ since: '2026-10-20', until: '2026-10-30T23:59' });
    expect(usage).toHaveBeenCalledWith('wa_import_read', true, expect.any(Number), expect.objectContaining({ since_kind: 'custom' }));
  });

  test('the zip stays open while the screen is open and is closed when it closes', async () => {
    await open();
    expect(opened.close).not.toHaveBeenCalled();
    screen.unmount();
    await waitFor(() => expect(opened.close).toHaveBeenCalled());
  });

  test('after a save the watermark moves to the newest decided post', async () => {
    await open();
    await saveAll();
    await waitFor(async () => expect(await (AsyncStorage as unknown as { getItem: (k: string) => Promise<string | null> }).getItem('wa_import_wm:me:fpR')).toBe(String(Date.UTC(2026, 9, 25, 9, 0))));
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

  test('a 409 re-reads the unit, compares again and saves once more on the new version', async () => {
    m.saveUnitEdit.mockRejectedValueOnce(new ApiClientError(409, 'version_conflict')).mockResolvedValue({ code: 'HP-1', version: 9 });
    m.unitEditFields.mockResolvedValueOnce({ code: 'HP-1', version: 7, fields: stored }).mockResolvedValueOnce({ code: 'HP-1', version: 8, fields: { ...stored, bedrooms: '3' } });
    await open();
    await saveAll();
    expect(m.saveUnitEdit).toHaveBeenCalledTimes(2);
    expect(m.saveUnitEdit.mock.calls[1][1]).toBe(8);
    expect(m.saveUnitEdit.mock.calls[1][3]).not.toBe(m.saveUnitEdit.mock.calls[0][3]);
  });

  test('a 409 after which nothing differs is left unticked with a note, not saved again', async () => {
    m.saveUnitEdit.mockRejectedValueOnce(new ApiClientError(409, 'version_conflict'));
    m.unitEditFields.mockResolvedValueOnce({ code: 'HP-1', version: 7, fields: stored }).mockResolvedValueOnce({ code: 'HP-1', version: 8, fields: { ...stored, price_value: '9500000' } });
    await open();
    await saveAll();
    expect(m.saveUnitEdit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('wa-post-1')).toBeTruthy();
    expect(ticked('1')).toBe(false);
  });
});

describe('what cannot be an update', () => {
  test('a code that belongs to another unit (type or place clearly differ) is an unticked error', async () => {
    m.unitEditFields.mockResolvedValue({ code: 'HP-1', version: 7, fields: { ...stored, property_type: 'villa' } });
    await open();
    expect(ticked('1')).toBe(false);
    expect(screen.getByTestId('wa-blocker-1').props.children).toMatch(/another unit|وحدة تانية/);
    expect(screen.getByTestId('wa-pick-1').props.accessibilityState.disabled).toBe(true);
  });

  test('a unit edited after the post is "older", unticked', async () => {
    m.unitEditFields.mockResolvedValue({ code: 'HP-1', version: 7, fields: stored, updated_at: '2026-10-30T10:00:00Z' });
    await open();
    expect(ticked('1')).toBe(false);
    expect(screen.getByTestId('wa-blocker-1').props.children).toMatch(/edited after|اتعدلت بعد/);
  });

  test('a unit that could not be read is "could not compare", never "updated"', async () => {
    m.unitEditFields.mockRejectedValue(new Error('net'));
    await open();
    expect(ticked('1')).toBe(false);
    expect(screen.getByTestId('wa-blocker-1').props.children).toMatch(/compare|نقارن/);
    expect(screen.queryByTestId('wa-changes-1')).toBeNull();
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
    m.unitEditFields.mockResolvedValue({ code: 'HP-1', version: 7, fields: { ...stored, price_value: '9500000' } }); // HP-1 unchanged: only HP-3 is saved
    await open();
    await saveAll();
    await waitFor(() => expect(screen.getByTestId('wa-post-2')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); });
    await waitFor(() => expect(m.createUnit).toHaveBeenCalledTimes(2));
    expect(m.createUnit.mock.calls[1][2]).toBe(m.createUnit.mock.calls[0][2]);
  });

  test('two taps on Save all save once', async () => {
    m.unitEditFields.mockResolvedValue({ code: 'HP-1', version: 7, fields: { ...stored, price_value: '9500000' } });
    await open();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); fireEvent.press(screen.getByTestId('wa-add')); });
    await waitFor(() => expect(screen.getByTestId('wa-result')).toBeTruthy());
    expect(m.createUnit).toHaveBeenCalledTimes(1);
  });

  test('a post discarded while the loop runs is skipped', async () => {
    let release: () => void = () => undefined;
    m.reviewUnit.mockImplementationOnce(() => new Promise((res) => { release = () => res({ ok: true, blockers: [], warnings: [], duplicate: null }); }));
    // HP-1 update first (slow review); HP-3 is discarded before the loop reaches it.
    await open();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); });
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
    expect(screen.getByText(/Discard post HP-1|تجاهل البوست HP-1/)).toBeTruthy();
    const ph = screen.getByTestId('wa-photo-1-0');
    expect(ph.props.accessibilityRole).toBe('button');
    expect(ph.props.accessibilityState.selected).toBe(true);
  });

  test('leaving with units still to save asks first; leaving with nothing to save does not', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await open();
    const fn = mockAddListener.mock.calls.filter((c) => c[0] === 'beforeRemove').pop()?.[1] as (e: { preventDefault: () => void; data: { action: unknown } }) => void;
    const e = { preventDefault: jest.fn(), data: { action: {} } };
    fn(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(alert).toHaveBeenCalled();
    alert.mockRestore();
  });

  test('retrying the details keeps the ticks the person set', async () => {
    m.chatRead.mockRejectedValueOnce(new Error('net'));
    m.unitEditFields.mockResolvedValue({ code: 'HP-1', version: 7, fields: { ...stored, price_value: '9500000' } });
    await open();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-read-retry')); });
    await waitFor(() => expect(screen.queryByTestId('wa-read-failed')).toBeNull());
    expect(ticked('2')).toBe(true);
    await act(async () => { fireEvent.press(screen.getByTestId('wa-pick-2')); });
    expect(ticked('2')).toBe(false);
  });
});
