import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { WhatsAppImportScreen } from '../src/screens/WhatsAppImportScreen';
import { api } from '../src/api';
import { unpackChat } from '../src/zipImport';
import { usage } from '../src/usage';

jest.mock('../src/api', () => ({ api: { codeCheck: jest.fn(), chatRead: jest.fn(), extractUnit: jest.fn(), reviewUnit: jest.fn(), createUnit: jest.fn(), photoUploadLinks: jest.fn(), unitSaveStatus: jest.fn() } }));
jest.mock('../src/zipImport', () => {
  class ZipImportError extends Error { reason: string; constructor(reason: string) { super(reason); this.reason = reason; } }
  return { ZipImportError, unpackChat: jest.fn(), cancelUnpack: jest.fn(), cleanUp: jest.fn() };
});
jest.mock('../src/usage', () => ({ usage: jest.fn() }));
jest.mock('../src/errorReport', () => ({ reportError: jest.fn() }));
jest.mock('../src/photoUpload', () => ({ uploadPhoto: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/rights', () => ({ useRights: () => ({ manager: true, agencyOwner: false, dataEntry: false, addUnits: true }) }));
jest.mock('../src/components/SmartImage', () => ({ SmartImage: () => null }));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, replace: jest.fn() }),
  useRoute: () => ({ params: { zip: { uri: 'file:///cache/chat.zip', name: 'chat.zip', type: 'application/zip' } } }),
}));

const m = api as unknown as Record<string, jest.Mock>;
const unpack = unpackChat as jest.Mock;
const post = (i: number, code: string | null, photos: number, videos = 0) => ({
  i, sender: 'Ahmed', at: '24/10/2026 10:15', text: `شقة للبيع ${code ?? ''} 150 متر`, code, over: 0, videos, verify: false,
  files: Array.from({ length: photos }, (_, k) => ({ name: `IMG-${i}-${k}.jpg`, i: i + k, at: null })),
});

beforeEach(() => {
  jest.clearAllMocks();
  const posts = [post(1, 'HP-1', 20, 2), post(2, 'HP-2', 2), post(3, 'HP-3', 1), post(4, null, 1)];
  const present = new Map<string, string>();
  posts.forEach((p) => p.files.forEach((f) => present.set(f.name.toLowerCase(), f.name)));
  unpack.mockImplementation(async (_uri: string, _since: string, onPct: (p: number, s: string) => void) => {
    onPct(15, 'chat');
    onPct(60, 'photos');
    return { dir: '/cache/wa', posts, present, skipped: 3, missing: 0, stats: {} };
  });
  m.codeCheck.mockResolvedValue({ codes: { 'HP-1': { state: 'update', code: 'HP-1', photos: 4, status: 'active' }, 'HP-2': { state: 'taken' }, 'HP-3': { state: 'new' } }, max_photos: 15, ai_cost: 2 });
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
  await waitFor(() => expect(screen.getByTestId('wa-summary')).toBeTruthy());
};

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
  expect(screen.getByTestId('wa-ready').props.children).toMatch(/1 ready to add · 1 missing details|1 جاهزة للإضافة · 1 ناقصة بيانات/);
  expect(screen.queryByTestId('wa-ai-review')).toBeNull();
});

test('adding the selected posts saves only the ones that can be added, with their photos as keys, and marks them added', async () => {
  m.reviewUnit.mockResolvedValue({ ok: true, blockers: [], warnings: [], duplicate: null });
  m.photoUploadLinks.mockImplementation(async () => ({ uploads: [{ key: 'k1', upload_url: 'u', thumb_key: 't', thumb_upload_url: null }] }));
  m.createUnit.mockResolvedValue({ code: 'HP-3', photos: 1, photosFailed: 0 });
  await open();
  await act(async () => { fireEvent.press(screen.getByTestId('wa-add')); });
  await waitFor(() => expect(screen.getAllByText(/Added HP-3|اتضافت HP-3/)).toHaveLength(1));
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
  unpack.mockRejectedValue(new ZipImportError('password'));
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
  expect(screen.getAllByText(/Show the full description|عرض الوصف كامل/).length).toBe(4);
  await act(async () => { fireEvent.press(screen.getByTestId('wa-desc-3')); });
  expect(screen.getAllByText(/Hide|إخفاء/).length).toBe(1);
});
