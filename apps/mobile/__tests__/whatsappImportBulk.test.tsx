import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { WhatsAppImportScreen } from '../src/screens/WhatsAppImportScreen';
import { api } from '../src/api';
import { unpackChat } from '../src/zipImport';
import { lacksDealType, lacksOwnerPhone, missingOf, withDealType, withOwnerPhone } from '../src/whatsappImport';
import type { ImportPost } from '../src/whatsappImport';

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
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), replace: jest.fn(), popTo: jest.fn() }),
  useRoute: () => ({ params: { zip: { uri: 'file:///cache/chat.zip', name: 'chat.zip', type: 'application/zip' } } }),
}));

const m = api as unknown as Record<string, jest.Mock>;
const post = (i: number, code: string) => ({ i, sender: '+20 111 161 6455', at: '15/11/2026 5:48', text: `Code ${code} Mivida 154m 2 bedrooms Price 65k`, code, over: 0, videos: 0, verify: false, files: [{ name: `IMG-${i}.jpg`, i, at: null }] });
const base = { property_type: 'apartment', compound: 'Mivida', price_value: '65000', area_value: '154', bedrooms: '2' };

beforeEach(() => {
  jest.clearAllMocks();
  const posts = [post(1, 'MIR23'), post(2, 'MIR40'), post(3, 'MIR590')];
  const present = new Map<string, string>();
  posts.forEach((p) => p.files.forEach((f) => present.set(f.name.toLowerCase(), f.name)));
  (unpackChat as jest.Mock).mockImplementation(async () => ({ dir: '/cache/wa', posts, present, skipped: 0, missing: 0, stats: {} }));
  m.codeCheck.mockResolvedValue({ codes: { MIR23: { state: 'new' }, MIR40: { state: 'new' }, MIR590: { state: 'new' } }, max_photos: 15, ai_cost: 2 });
  // Like the real chat: the reader cannot tell sale from rent for two posts (no "year", no "for rent"), and no post has an owner phone.
  m.chatRead.mockResolvedValue({ posts: [
    { fields: { ...base, code: 'MIR23' }, missing: ['listing_type', 'owner_phone'] },
    { fields: { ...base, code: 'MIR40' }, missing: ['listing_type', 'owner_phone'] },
    { fields: { ...base, code: 'MIR590', listing_type: 'rent' }, missing: ['owner_phone'] },
  ] });
  m.reviewUnit.mockImplementation(async (fields: Record<string, string>) => ({ ok: true, blockers: [...(fields.listing_type ? [] : [{ field: 'listing_type', label: 'Sale or rent' }]), ...(fields.owner_phone ? [] : [{ field: 'owner_phone', label: 'Owner phone' }])], warnings: [], duplicate: null }));
});

const open = async () => {
  await act(async () => { render(<WhatsAppImportScreen />); });
  await waitFor(() => expect(screen.getByTestId('wa-summary')).toBeTruthy());
};
const post0 = (over: Partial<ImportPost> = {}): ImportPost => ({ id: '1', post: post(1, 'X') as never, photos: [], picked: true, state: 'idle', fields: { ...base }, missing: [], ...over });

describe('the helpers', () => {
  test('which posts still need a deal type or an owner phone', () => {
    expect(lacksDealType(post0())).toBe(true);
    expect(lacksDealType(post0({ fields: { ...base, listing_type: 'rent' } }))).toBe(false);
    expect(lacksDealType(post0({ state: 'saved' }))).toBe(false);
    expect(lacksOwnerPhone(post0())).toBe(true);
    expect(lacksOwnerPhone(post0({ fields: { ...base, owner_phone: '01012345678' } }))).toBe(false);
  });
  test('a rent gets the monthly period unless it has one; the phone stands in for the name', () => {
    expect(withDealType({ ...base }, 'rent')).toMatchObject({ listing_type: 'rent', rent_period: 'monthly' });
    expect(withDealType({ ...base, rent_period: 'yearly' }, 'rent').rent_period).toBe('yearly');
    expect(withDealType({ ...base }, 'sale').rent_period).toBeUndefined();
    expect(withOwnerPhone({ ...base }, '01012345611')).toMatchObject({ owner_phone: '01012345611', owner_name_from_phone: '1' });
    expect(withOwnerPhone({ ...base, owner_name: 'Omar' }, '01012345611').owner_name_from_phone).toBeUndefined();
  });
  test('the blockers become the missing list, once each', () => {
    expect(missingOf([{ field: 'owner_phone' }, { field: 'owner_phone' }, { field: 'listing_type' }])).toEqual(['owner_phone', 'listing_type']);
  });
});

describe('the Fix many at once card', () => {
  test('All rent sets rent on the posts that had no type and leaves the others alone', async () => {
    await open();
    expect(screen.getByTestId('wa-bulk')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-all-rent')); });
    await waitFor(() => expect(screen.getByTestId('wa-bulk-done')).toBeTruthy());
    expect(m.reviewUnit).toHaveBeenCalledTimes(2);
    expect(m.reviewUnit.mock.calls[0][0]).toMatchObject({ listing_type: 'rent', rent_period: 'monthly' });
    expect(screen.queryByTestId('wa-all-rent')).toBeNull();
    expect(screen.getByTestId('wa-owner-apply')).toBeTruthy();
    expect(screen.queryByTestId('wa-missing-1-listing_type')).toBeNull();
    expect(screen.getByTestId('wa-missing-1-owner_phone')).toBeTruthy();
  });

  test('one owner phone goes on every post that lacks it, and the posts become ready to add', async () => {
    await open();
    await act(async () => { fireEvent.press(screen.getByTestId('wa-all-sale')); });
    await waitFor(() => expect(screen.queryByTestId('wa-all-sale')).toBeNull());
    await act(async () => { fireEvent.changeText(screen.getByTestId('wa-owner-all'), '01012345611'); });
    await act(async () => { fireEvent.press(screen.getByTestId('wa-owner-apply')); });
    await waitFor(() => expect(screen.queryByTestId('wa-owner-apply')).toBeNull());
    expect(m.reviewUnit.mock.calls.slice(-3).every((c) => c[0].owner_phone === '01012345611' && c[0].owner_name_from_phone === '1')).toBe(true);
    expect(screen.queryByTestId('wa-missing-1-owner_phone')).toBeNull();
  });

  test('a phone that is not an Egyptian mobile is refused and nothing is sent', async () => {
    await open();
    await act(async () => { fireEvent.changeText(screen.getByTestId('wa-owner-all'), '123'); });
    await act(async () => { fireEvent.press(screen.getByTestId('wa-owner-apply')); });
    expect(screen.getByTestId('wa-owner-bad')).toBeTruthy();
    expect(m.reviewUnit).not.toHaveBeenCalled();
  });
});

test('the card shows the land area, floor and rent period the reader found (not only the built-up area)', async () => {
  m.chatRead.mockResolvedValue({ posts: [
    { fields: { ...base, code: 'MIR23', listing_type: 'rent', rent_period: 'yearly', land_area: '347', floor_level: '4' }, missing: ['owner_phone'] },
    { fields: { ...base, code: 'MIR40', listing_type: 'rent' }, missing: ['owner_phone'] },
    { fields: { ...base, code: 'MIR590', listing_type: 'rent' }, missing: ['owner_phone'] },
  ] });
  await open();
  const card = JSON.stringify(screen.toJSON());
  expect(card).toContain('347');
  expect(card).toMatch(/سنوي|Yearly/);
  expect(card).toMatch(/الدور|Floor/);
});

test('a post whose code is an existing unit is reviewed as that unit (its own code is not reported as missing or taken)', async () => {
  m.codeCheck.mockResolvedValue({ codes: { MIR23: { state: 'new' }, MIR40: { state: 'update', code: 'MIR40', photos: 12, status: 'active' }, MIR590: { state: 'new' } }, max_photos: 15, ai_cost: 2 });
  await open();
  await act(async () => { fireEvent.press(screen.getByTestId('wa-all-rent')); });
  await waitFor(() => expect(screen.getByTestId('wa-bulk-done')).toBeTruthy());
  const withCode = m.reviewUnit.mock.calls.find((c) => c[0].code === 'MIR40');
  expect(withCode?.[2]).toBe('MIR40');
  const others = m.reviewUnit.mock.calls.filter((c) => c[0].code !== 'MIR40');
  expect(others.every((c) => c[2] === undefined)).toBe(true);
});
