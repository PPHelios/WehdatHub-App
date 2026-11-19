import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { WhatsAppImportScreen } from '../src/screens/WhatsAppImportScreen';
import { api } from '../src/api';
import { openChat, readChat } from '../src/zipImport';
import { usage } from '../src/usage';

jest.mock('../src/api', () => ({ api: { codeCheck: jest.fn(), chatRead: jest.fn(), extractUnit: jest.fn(), reviewUnit: jest.fn(), createUnit: jest.fn(), photoUploadLinks: jest.fn(), unitSaveStatus: jest.fn(), unitEditFields: jest.fn(), saveUnitEdit: jest.fn(), unitPhotos: jest.fn() } }));
jest.mock('../src/zipImport', () => {
  class ZipImportError extends Error { reason: string; constructor(reason: string) { super(reason); this.reason = reason; } }
  return { ZipImportError, openChat: jest.fn(), readChat: jest.fn(), cancelUnpack: jest.fn(), cleanUp: jest.fn() };
});
jest.mock('../src/usage', () => ({ usage: jest.fn() }));
jest.mock('../src/errorReport', () => ({ reportError: jest.fn() }));
jest.mock('../src/photoUpload', () => ({ uploadPhoto: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/rights', () => ({ useRights: () => ({ manager: true, agencyOwner: false, dataEntry: false, addUnits: true }) }));
jest.mock('../src/components/SmartImage', () => ({ SmartImage: () => null }));
const mockNavigate = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());
const mockZip = { uri: 'file:///cache/chat.zip', name: 'chat.zip', type: 'application/zip' };
let mockRoute: { params: Record<string, unknown> } = { params: { zip: mockZip } };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, replace: jest.fn(), dispatch: jest.fn(), addListener: mockAddListener }),
  useRoute: () => mockRoute,
}));

const m = api as unknown as Record<string, jest.Mock>;
const opened = { zipPath: '/cache/chat.zip', chatText: '', info: { firstAt: Date.UTC(2026, 8, 1), lastAt: Date.UTC(2026, 9, 24), total: 120, perDay: { '2026-10-24': 10, '2026-10-01': 5, '2026-09-01': 3 }, fingerprint: 'fp1' }, close: jest.fn().mockResolvedValue(undefined) };
const unpack = readChat as jest.Mock;
const openMock = openChat as jest.Mock;
const post = (i: number, code: string | null, photos: number, videos = 0) => ({
  i, sender: 'Ahmed', at: '24/10/2026 10:15', text: `شقة للبيع ${code ?? ''} 150 متر ${code ? "01012345678" : ""}`, code, over: 0, videos, verify: false,
  files: Array.from({ length: photos }, (_, k) => ({ name: `IMG-${i}-${k}.jpg`, i: i + k, at: null })),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute = { params: { zip: mockZip } };
  const posts = [post(1, 'HP-1', 20, 2), post(2, 'HP-2', 2), post(3, 'HP-3', 1), post(4, null, 1)];
  const present = new Map<string, string>();
  posts.forEach((p) => p.files.forEach((f) => present.set(f.name.toLowerCase(), f.name)));
  openMock.mockResolvedValue(opened);
  unpack.mockImplementation(async (_o: unknown, o: { onPct?: (p: number, s: string) => void }) => {
    o.onPct?.(15, 'chat');
    o.onPct?.(60, 'photos');
    return { dir: '/cache/wa', posts, present, skipped: 3, missing: 0, stats: {} };
  });
  m.codeCheck.mockResolvedValue({ codes: { 'HP-1': { state: 'update', code: 'HP-1', photos: 4, status: 'active' }, 'HP-2': { state: 'taken' }, 'HP-3': { state: 'new' } }, max_photos: 15, ai_cost: 2 });
  // The stored unit HP-1 points to: the same values the post states, so by default the post is unchanged.
  m.unitEditFields.mockResolvedValue({ code: 'HP-1', version: 7, fields: { listing_type: 'sale', property_type: 'apartment', compound: 'Hyde Park', price_value: '8000000', area_value: '150', bedrooms: '3', owner_phone: '01012345678', notes: 'old note' } });
  // The server's rules reader: post 4 has no owner phone and no place, so it is incomplete; the others are complete.
  const complete = { listing_type: 'sale', property_type: 'apartment', compound: 'Hyde Park', price_value: '8000000', area_value: '150', bedrooms: '3', owner_phone: '01012345678' };
  m.chatRead.mockResolvedValue({ posts: [
    { fields: { ...complete, code: 'HP-1' }, missing: [] },
    { fields: { ...complete, code: 'HP-2' }, missing: [] },
    { fields: { ...complete, code: 'HP-3' }, missing: [] },
    { fields: { listing_type: 'sale', property_type: 'apartment', price_value: '8000000', area_value: '150', bedrooms: '3' }, missing: ['compound', 'owner_phone'] },
  ] });
});

const open = async () => {
  await act(async () => { render(<WhatsAppImportScreen />); });
  await waitFor(() => expect(screen.getByTestId('wa-range-read')).toBeTruthy());
  await act(async () => { fireEvent.press(screen.getByTestId('wa-range-read')); });
  await waitFor(() => expect(screen.getByTestId('wa-summary')).toBeTruthy());
};

const clearErrors = async () => { await act(async () => { fireEvent.press(screen.getByTestId('wa-discard-errors')); }); };
const ready = () => screen.getByTestId('wa-ready').props.children as string;
const ticked = (id: string) => screen.getByTestId(`wa-pick-${id}`).props.accessibilityState.checked as boolean;

test('the codes are checked once after the read: update, taken and new show their badge; videos are counted', async () => {
  await open();
  expect(m.codeCheck).toHaveBeenCalledTimes(1);
  expect(m.codeCheck.mock.calls[0][0].sort()).toEqual(['HP-1', 'HP-2', 'HP-3']);
  expect(screen.getByTestId('wa-badge-update')).toBeTruthy();
  expect(screen.getByTestId('wa-badge-taken')).toBeTruthy();
  expect(screen.getByTestId('wa-badge-new')).toBeTruthy();
  expect(screen.getByText(/Code belongs to a unit you can't change|الكود ده لوحدة مش من حقك تعدلها/)).toBeTruthy();
  expect(screen.getByText(/3 videos skipped|3 فيديو اتتخطى/)).toBeTruthy();
  expect(screen.getByText(/2 videos skipped|2 فيديو اتتخطى/)).toBeTruthy(); // the videos next to the first post
});

test('a post with more than 15 photos keeps the first 15; tapping a photo changes what is kept', async () => {
  await open();
  expect(screen.getByTestId('wa-count-1').props.children.join('')).toMatch(/15 \/ 15|15 \/ 15/);
});

test('every post is read by the server reader once: a summary shows, and a post missing mandatory fields shows them in red and is not counted as ready', async () => {
  await open();
  expect(m.chatRead).toHaveBeenCalledTimes(1);
  expect(m.chatRead.mock.calls[0][0]).toHaveLength(4);
  expect(screen.getByTestId('wa-summary-3')).toBeTruthy();
  expect(screen.getByTestId('wa-missing-4-compound')).toBeTruthy();
  expect(screen.getByTestId('wa-missing-4-owner_phone')).toBeTruthy();
  expect(screen.getByTestId('wa-missing-note-4')).toBeTruthy();
  // The update (HP-1), the taken (HP-2) and the incomplete post (4) are opened by hand: only HP-3 is ready.
  // The 2 left out (update, taken) are blocked and said so: the header total is the 4 unsaved posts, the bar splits them 1 + 1 + 2.
  expect(ready()).toMatch(/Will save 1 \(1 new, 0 updated\) · skipping 3 \(errors 2, unchanged 1, discarded 0\)|هيتحفظ 1 \(1 جديدة، 0 متحدّثة\) · هيتخطى 3/);
  expect(screen.getByTestId('wa-summary').props.children).toMatch(/4 posts · 24 photos|4 بوست · 24 صورة/);
  expect(screen.queryByTestId('wa-ai-review')).toBeNull();
});

test('adding the selected posts saves only the ones that can be added, with their photos as keys, and marks them added', async () => {
  m.reviewUnit.mockResolvedValue({ ok: true, blockers: [], warnings: [], duplicate: null });
  m.photoUploadLinks.mockImplementation(async () => ({ uploads: [{ key: 'k1', upload_url: 'u', thumb_key: 't', thumb_upload_url: null }] }));
  m.createUnit.mockResolvedValue({ code: 'HP-3', photos: 1, photosFailed: 0 });
  await open();
  await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); });
  await waitFor(() => expect(screen.queryByTestId('wa-post-3')).toBeNull());
  // HP-1 (an update), HP-2 (taken) and the incomplete post are not added in bulk; only HP-3 is, with the reader's fields.
  expect(m.createUnit).toHaveBeenCalledTimes(1);
  expect(m.createUnit.mock.calls[0][3]).toEqual(['k1']);
  expect(m.createUnit.mock.calls[0][0]).toMatchObject({ property_type: 'apartment', compound: 'Hyde Park', owner_phone: '01012345678' });
  expect(m.extractUnit).not.toHaveBeenCalled();
});

test('the unit form check still decides: a post the form rules reject is left for the edit screen, and AI is never called', async () => {
  m.reviewUnit.mockResolvedValue({ ok: false, blockers: [{ field: 'area_value', label: 'Area' }], warnings: [], duplicate: null });
  await open();
  await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); });
  await waitFor(() => expect(screen.getAllByText(/Needs edit|محتاجة تعديل/).length).toBeGreaterThan(0));
  expect(m.extractUnit).not.toHaveBeenCalled();
  expect(m.createUnit).not.toHaveBeenCalled();
});

test('Edit opens the add-unit form with the fields the reader found, never AI', async () => {
  await open();
  await act(async () => { fireEvent.press(screen.getAllByText(/^Edit$|^تعديل$/).slice(-1)[0]); });
  expect(mockNavigate).toHaveBeenCalledWith('AddUnit', expect.objectContaining({ noAi: true, importId: '4', fields: expect.objectContaining({ property_type: 'apartment' }) }));
});

test('every step is logged: the read, the code check, and each added post with its outcome (no names, phones or text)', async () => {
  m.reviewUnit.mockResolvedValue({ ok: true, blockers: [], warnings: [], duplicate: null });
  m.photoUploadLinks.mockImplementation(async () => ({ uploads: [{ key: 'k1', upload_url: 'u', thumb_key: 't', thumb_upload_url: null }] }));
  m.createUnit.mockResolvedValue({ code: 'HP-3', photos: 1, photosFailed: 0 });
  await open();
  const u = usage as jest.Mock;
  expect(u).toHaveBeenCalledWith('wa_import_read', true, expect.any(Number), expect.objectContaining({ posts: 4, videos: 3 }));
  expect(u).toHaveBeenCalledWith('wa_import_codes', true, expect.any(Number), { count: 3 });
  await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); });
  await waitFor(() => expect(u.mock.calls.filter((c) => c[0] === 'wa_import_add')).toHaveLength(1));
  expect(u).toHaveBeenCalledWith('wa_import_reader', true, expect.any(Number), { posts: 4, incomplete: 1 });
  expect(u).toHaveBeenCalledWith('wa_import_add', true, expect.any(Number), expect.objectContaining({ outcome: 'saved', ai: false }));
  const sent = JSON.stringify(u.mock.calls);
  expect(sent).not.toMatch(/01012345678|Ahmed|شقة/);
});

test('a failed read is logged with its reason', async () => {
  const { ZipImportError } = jest.requireMock('../src/zipImport');
  openMock.mockRejectedValue(new ZipImportError('password'));
  await act(async () => { render(<WhatsAppImportScreen />); });
  await waitFor(() => expect(screen.getByTestId('wa-error')).toBeTruthy());
  expect(usage).toHaveBeenCalledWith('wa_import_read', false, expect.any(Number), expect.objectContaining({ reason: 'password' }));
});

test('when the reader cannot be reached the list says so and a retry fills the summaries; Edit still passes the post\'s own code', async () => {
  m.chatRead.mockRejectedValueOnce(new Error('network'));
  await open();
  expect(screen.getByTestId('wa-read-failed')).toBeTruthy();
  expect(screen.queryByTestId('wa-summary-3')).toBeNull();
  await act(async () => { fireEvent.press(screen.getByTestId('wa-read-retry')); });
  await waitFor(() => expect(screen.getByTestId('wa-summary-3')).toBeTruthy());
  expect(screen.queryByTestId('wa-read-failed')).toBeNull();
});

test('Edit passes the code written in the post, even when the reader found nothing', async () => {
  m.chatRead.mockRejectedValueOnce(new Error('network'));
  await open();
  await act(async () => { fireEvent.press(screen.getAllByText(/^Edit$|^تعديل$/)[1]); });
  expect(mockNavigate).toHaveBeenCalledWith('AddUnit', expect.objectContaining({ code: 'HP-3', noAi: true }));
});

test('the photos have no arrows (the order is set in the edit screen) and the description opens in full', async () => {
  await open();
  expect(screen.queryByText('›')).toBeNull();
  expect(screen.queryByText('‹')).toBeNull();
  expect(screen.getAllByText(/Original message|الرسالة الأصلية/).length).toBe(4);
  expect(screen.getAllByText(/Show the full message|عرض الرسالة كاملة/).length).toBe(4);
  await act(async () => { fireEvent.press(screen.getByTestId('wa-desc-3')); });
  expect(screen.getAllByText(/Hide|إخفاء/).length).toBe(1);
});

const split = (txt: string) => (txt.match(/\d+/g) ?? []).map(Number);

test('an added post leaves the list: its card is gone, the header and bottom counts shrink and still agree', async () => {
  m.reviewUnit.mockResolvedValue({ ok: true, blockers: [], warnings: [], duplicate: null });
  m.photoUploadLinks.mockImplementation(async () => ({ uploads: [{ key: 'k1', upload_url: 'u', thumb_key: 't', thumb_upload_url: null }] }));
  m.createUnit.mockResolvedValue({ code: 'HP-3', photos: 1, photosFailed: 0 });
  await open();
  await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); });
  await waitFor(() => expect(screen.queryByTestId('wa-post-3')).toBeNull());
  expect(screen.getByTestId('wa-post-1')).toBeTruthy();
  expect(screen.queryByTestId('wa-summary-3')).toBeNull();
  expect(screen.queryByText(/Open|^افتح$/)).toBeNull();
  expect(split(screen.getByTestId('wa-summary').props.children)).toEqual([3, 23]);
  expect(screen.getByTestId('wa-saved-line').props.children).toMatch(/1 added|اتضافت 1/);
  expect(ready()).toMatch(/Will save 0 \(0 new, 0 updated\) · skipping 3 \(errors 2, unchanged 1, discarded 0\)|هيتحفظ 0/);
  expect(screen.getByTestId('wa-result-unchanged').props.children).toMatch(/HP-1/);
});

test('a post saved in the edit screen (route.params.saved) disappears and the counts shrink', async () => {
  await open();
  expect(screen.getByTestId('wa-post-4')).toBeTruthy();
  mockRoute = { params: { zip: mockZip, saved: { id: '4', code: 'X-9' } } };
  await act(async () => { screen.rerender(<WhatsAppImportScreen />); });
  await waitFor(() => expect(screen.queryByTestId('wa-post-4')).toBeNull());
  expect(screen.queryByTestId('wa-missing-note-4')).toBeNull();
  const [posts] = split(screen.getByTestId('wa-summary').props.children);
  expect(posts).toBe(3);
  expect(ready()).toMatch(/Will save 1 \(1 new, 0 updated\) · skipping 2 \(errors 1, unchanged 1, discarded 0\)|هيتحفظ 1/);
  expect(screen.getByTestId('wa-saved-line')).toBeTruthy();
});

test('when every post is added a short message replaces the list', async () => {
  await open();
  for (const id of ['1', '2', '3', '4']) {
    mockRoute = { params: { zip: mockZip, saved: { id, code: `C-${id}` } } };
    await act(async () => { screen.rerender(<WhatsAppImportScreen />); });
  }
  await waitFor(() => expect(screen.getByTestId('wa-all-added')).toBeTruthy());
  expect(screen.queryByTestId('wa-post-1')).toBeNull();
  expect(screen.getByTestId('wa-summary').props.children).toMatch(/0 posts|0 بوست/);
});

test('Discard hides a new post and a post matching an existing unit, and the counts shrink', async () => {
  await open();
  await act(async () => { fireEvent.press(screen.getByTestId('wa-discard-3')); });
  await act(async () => { fireEvent.press(screen.getByTestId('wa-discard-1')); });
  expect(screen.queryByTestId('wa-post-3')).toBeNull();
  expect(screen.queryByTestId('wa-post-1')).toBeNull();
  expect(split(screen.getByTestId('wa-summary').props.children)[0]).toBe(2);
  expect(screen.getByTestId('wa-discarded-bar')).toBeTruthy();
  expect(usage).toHaveBeenCalledWith('wa_import_discard', true, undefined, { kind: 'new' });
  expect(usage).toHaveBeenCalledWith('wa_import_discard', true, undefined, { kind: 'update' });
});

test('Restore brings a discarded post back, one by one and all at once', async () => {
  await open();
  await act(async () => { fireEvent.press(screen.getByTestId('wa-discard-3')); });
  await act(async () => { fireEvent.press(screen.getByTestId('wa-discard-4')); });
  await act(async () => { fireEvent.press(screen.getByText(/2 discarded|2 بوست متجاهل/)); });
  await act(async () => { fireEvent.press(screen.getByTestId('wa-restore-3')); });
  expect(screen.getByTestId('wa-post-3')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByTestId('wa-restore-all')); });
  expect(screen.getByTestId('wa-post-4')).toBeTruthy();
  expect(screen.queryByTestId('wa-discarded-bar')).toBeNull();
});

test('errors never block Save all: they are skipped and counted, and Discard clears errors and unchanged units', async () => {
  await open();
  expect(screen.queryByTestId('wa-errors-left')).toBeNull();
  expect(screen.getByTestId('wa-add').props.accessibilityState?.disabled ?? screen.getByTestId('wa-add').props.disabled).toBeFalsy();
  await clearErrors();
  expect(screen.queryByTestId('wa-discard-errors')).toBeNull();
  expect(screen.queryByTestId('wa-post-1')).toBeNull(); // unchanged
  expect(screen.queryByTestId('wa-post-2')).toBeNull(); // taken
  expect(screen.queryByTestId('wa-post-4')).toBeNull(); // incomplete
  expect(screen.getByTestId('wa-post-3')).toBeTruthy();
  expect(ready()).toMatch(/Will save 1 \(1 new, 0 updated\) · skipping 3 \(errors 0, unchanged 0, discarded 3\)|هيتحفظ 1/);
});

test('default ticks: only the valid new unit is ticked; errors cannot be ticked; an unchanged unit is unticked and says so', async () => {
  await open();
  expect([ticked('1'), ticked('2'), ticked('3'), ticked('4')]).toEqual([false, false, true, false]);
  expect(screen.getByTestId('wa-unchanged-1')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByTestId('wa-pick-4')); });
  expect(ticked('4')).toBe(false);
  await act(async () => { fireEvent.press(screen.getByTestId('wa-pick-3')); });
  expect(ticked('3')).toBe(false);
  expect(ready()).toMatch(/Will save 0 .*unticked 1|هيتحفظ 0/);
  expect(screen.getByTestId('wa-add').props.accessibilityState?.disabled ?? screen.getByTestId('wa-add').props.disabled).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByTestId('wa-select-valid')); });
  expect(ticked('3')).toBe(true);
  expect(ticked('1')).toBe(false);
});

test('an unchanged unit ticked by hand is still not saved: no write, no photos, listed as unchanged in the result', async () => {
  m.reviewUnit.mockResolvedValue({ ok: true, blockers: [], warnings: [], duplicate: null });
  m.photoUploadLinks.mockImplementation(async () => ({ uploads: [{ key: 'k1', upload_url: 'u', thumb_key: 't', thumb_upload_url: null }] }));
  m.createUnit.mockResolvedValue({ code: 'HP-3', photos: 1, photosFailed: 0 });
  await open();
  await act(async () => { fireEvent.press(screen.getByTestId('wa-pick-1')); });
  expect(ticked('1')).toBe(true);
  await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); });
  await waitFor(() => expect(screen.getByTestId('wa-result')).toBeTruthy());
  expect(m.saveUnitEdit).not.toHaveBeenCalled();
  expect(m.unitPhotos).not.toHaveBeenCalled();
  expect(m.createUnit).toHaveBeenCalledTimes(1);
  expect(m.photoUploadLinks).toHaveBeenCalledTimes(1); // HP-3's only
  expect(screen.getByTestId('wa-result-unchanged').props.children).toMatch(/HP-1/);
});

test('a post that changes the price is ticked, saved as an edit of that unit with the post fields on top, and its photos uploaded', async () => {
  m.chatRead.mockResolvedValue({ posts: [
    { fields: { listing_type: 'sale', property_type: 'apartment', compound: 'Hyde Park', price_value: '9500000', area_value: '150', bedrooms: '3', owner_phone: '01012345678', code: 'HP-1', clean_summary: 'new text' }, missing: [] },
    { fields: { code: 'HP-2' }, missing: [] },
    { fields: { code: 'HP-3', listing_type: 'sale', property_type: 'apartment', compound: 'Hyde Park', price_value: '8000000', area_value: '150', bedrooms: '3', owner_phone: '01012345678' }, missing: [] },
    { fields: {}, missing: ['compound'] },
  ] });
  m.reviewUnit.mockResolvedValue({ ok: true, blockers: [], warnings: [], duplicate: null });
  m.photoUploadLinks.mockImplementation(async () => ({ uploads: Array.from({ length: 15 }, (_, k) => ({ key: `k${k}`, upload_url: 'u', thumb_key: 't', thumb_upload_url: null })) }));
  m.saveUnitEdit.mockResolvedValue({ code: 'HP-1', version: 8 });
  m.unitPhotos.mockResolvedValue({ images: [], failed: 0 });
  m.createUnit.mockResolvedValue({ code: 'HP-3', photos: 1, photosFailed: 0 });
  await open();
  expect(ticked('1')).toBe(true);
  expect(screen.getByTestId('wa-changes-1').props.children).toMatch(/Price|السعر/);
  expect(ready()).toMatch(/Will save 2 \(1 new, 1 updated\)|هيتحفظ 2/);
  await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); });
  await waitFor(() => expect(screen.getByTestId('wa-result')).toBeTruthy());
  expect(m.saveUnitEdit).toHaveBeenCalledTimes(1);
  expect(m.saveUnitEdit.mock.calls[0][0]).toBe('HP-1');
  expect(m.saveUnitEdit.mock.calls[0][1]).toBe(7);
  expect(m.saveUnitEdit.mock.calls[0][2]).toMatchObject({ price_value: '9500000', notes: 'old note' });
  expect(m.saveUnitEdit.mock.calls[0][2].clean_summary).toBeUndefined();
  expect(m.unitPhotos).toHaveBeenCalledWith('HP-1', { photoKeys: expect.any(Array) });
  expect(screen.queryByTestId('wa-post-1')).toBeNull();
});

test('Discard then Restore: a restored valid unit is ticked again, a restored error is not', async () => {
  await open();
  await act(async () => { fireEvent.press(screen.getByTestId('wa-discard-3')); });
  await act(async () => { fireEvent.press(screen.getByTestId('wa-discard-4')); });
  await act(async () => { fireEvent.press(screen.getByText(/2 discarded|2 بوست متجاهل/)); });
  await act(async () => { fireEvent.press(screen.getByTestId('wa-restore-3')); });
  await act(async () => { fireEvent.press(screen.getByTestId('wa-restore-4')); });
  expect(ticked('3')).toBe(true);
  expect(ticked('4')).toBe(false);
});
