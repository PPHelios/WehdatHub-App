import { KEEP, advanceWatermark, blockedByCode, countInRange, existingBlocker, foldArabic, lacksDealType, lacksOwnerPhone, loadAttached, loadWatermark, newestDecided, normCode, overlayUpdate, parseDateInput, resolveRange, saveAttached, toExisting, updatePhotoRoom, withImpliedOwner, buildImportPosts, changedFields, codeBadge, comparable, findChatText, hasError, importCounts, incomplete, kindOf, looksLikeZip, missingFor, photoEntriesFor, readPosts, savable, stagePct, withDefaultTicks, withTextPhoneOnly } from '../src/whatsappImport';
import type { CodeBadge, ImportPost } from '../src/whatsappImport';

const T = (hh: number, mm: number) => `24/10/2026, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
const photo = (n: string, at = T(10, 1)) => `${at} - Ahmed: IMG-${n}.jpg (file attached)`;
const say = (text: string, at = T(10, 0)) => `${at} - Ahmed: ${text}`;
const post = (code: string) => `شقة كود ${code} للبيع في التجمع 200 متر 3 غرف السعر 12 مليون`;

describe('whatsapp import helpers', () => {
  const lines = [say(post('HP-1'))];
  for (let k = 1; k <= 20; k += 1) lines.push(photo(`p${k}`));
  lines.push(`${T(10, 2)} - Ahmed: VID-9.mp4 (file attached)`);
  const { posts, stats } = readPosts(lines.join('\n'), null);

  it('reads the posts with their codes, all their photos and the videos left out', () => {
    expect(posts[0].code).toBe('HP-1');
    expect(posts[0].files).toHaveLength(20);
    expect(posts[0].videos).toBe(1);
    expect(stats.skippedMedia).toBe(1);
  });

  it('picks the chat text, and only the photos the posts name (never the video)', () => {
    const entries = [
      { path: 'WhatsApp Chat with Group.txt', size: 1000 },
      { path: 'notes.txt', size: 10 },
      { path: 'VID-9.mp4', size: 9_000_000 },
      ...Array.from({ length: 22 }, (_, k) => ({ path: `IMG-p${k + 1}.jpg`, size: 100 })),
    ];
    expect(findChatText(entries)?.path).toBe('WhatsApp Chat with Group.txt');
    const need = photoEntriesFor(posts, entries);
    expect(need.paths).toHaveLength(20);
    expect(need.paths).not.toContain('VID-9.mp4');
    expect(need.bytes).toBe(2000);
    expect(need.missing).toBe(0);
  });

  it('keeps the first 15 photos of a post and drops the ones missing from the zip', () => {
    const present = new Map(Array.from({ length: 19 }, (_, k) => [`img-p${k + 1}.jpg`, `IMG-p${k + 1}.jpg`] as [string, string]));
    const list = buildImportPosts(posts, '/cache/wa', present);
    expect(list[0].photos).toHaveLength(19);
    expect(list[0].photos.filter((p) => !p.notKept)).toHaveLength(KEEP);
    expect(list[0].photos[0].uri).toBe('file:///cache/wa/IMG-p1.jpg');
  });

  it('badges: a repeat of an earlier code, update, new and taken; a taken or repeated code is never added in bulk', () => {
    const list = buildImportPosts([posts[0], { ...posts[0], i: 99 }], '/c', new Map());
    // The newest post of a code stands; the earlier one is the repeat.
    expect(codeBadge(list, 1, { 'HP-1': { state: 'update', code: 'HP-1', photos: 4, status: 'active' } }, 'done')).toEqual({ kind: 'update', code: 'HP-1', photos: 4 });
    expect(codeBadge(list, 0, null, 'done')).toEqual({ kind: 'dup', of: 2 });
    expect(codeBadge(list, 1, { 'HP-1': { state: 'taken' } }, 'done')).toEqual({ kind: 'taken' });
    expect(codeBadge(list, 1, { 'HP-1': { state: 'new' } }, 'done')).toEqual({ kind: 'new', code: 'HP-1' });
    expect(codeBadge(list, 1, null, 'checking')).toEqual({ kind: 'checking' });
    expect(blockedByCode({ kind: 'taken' })).toBe(true);
    expect(blockedByCode({ kind: 'update', code: 'x', photos: 0 })).toBe(false);
  });

  it('a post missing a mandatory field is incomplete (never added in bulk); the bar only goes forward; zip files are recognised', () => {
    const list = buildImportPosts(posts, '/c', new Map());
    expect(incomplete(list[0])).toBe(false);
    expect(incomplete({ ...list[0], missing: [] })).toBe(false);
    expect(incomplete({ ...list[0], missing: ['owner_phone'] })).toBe(true);
    expect([stagePct('list', 1), stagePct('chat', 0.5), stagePct('photos', 0.5), stagePct('match', 1), stagePct('codes', 1)]).toEqual([5, 10, 50, 95, 100]);
    expect(looksLikeZip({ name: 'WhatsApp Chat - Group.zip' })).toBe(true);
    expect(looksLikeZip({ name: 'x', type: 'application/x-zip-compressed' })).toBe(true);
    expect(looksLikeZip({ name: 'a.jpg', type: 'image/jpeg' })).toBe(false);
  });
});


const mk = (id: string, extra: Partial<ImportPost> = {}): ImportPost => ({ id, post: { i: Number(id) } as never, picked: true, state: 'idle', photos: [], fields: { price_value: '1' }, ...extra });
const none: CodeBadge = { kind: 'none' };
const upd: CodeBadge = { kind: 'update', code: 'A-1', photos: 0 };
const stored = { price_value: '8000000', area_value: '150', bedrooms: '3', bathrooms: '2', floor_level: '4', finishing: 'finished', compound: 'Hyde Park', district: 'New Cairo', listing_type: 'sale', property_type: 'apartment', owner_name: 'Omar', owner_phone: '01012345678', is_ready: '1', delivery_year: '2027', down_payment_value: '500000', notes: 'old note', clean_summary: 'old text', summary_en: 'old en' };

describe('unchanged detection (mirrors the website chat import)', () => {
  it('a post that states the same values is unchanged, whatever the formatting', () => {
    expect(changedFields(stored, { ...stored })).toEqual([]);
    expect(changedFields(stored, { price_value: '8,000,000', area_value: '150.0', owner_phone: '+20 101 234 5678', compound: 'hyde  park', finishing: 'FINISHED' })).toEqual([]);
    expect(comparable('owner_phone', '00201012345678')).toBe('01012345678');
  });
  it('a field the post does not state never counts', () => {
    expect(changedFields(stored, { price_value: '', bedrooms: undefined })).toEqual([]);
  });
  it.each([
    ['price_value', '9000000', 'price_value'], ['area_value', '160', 'area_value'], ['bedrooms', '4', 'bedrooms'], ['bathrooms', '3', 'bathrooms'],
    ['floor_level', '5', 'floor'], ['finishing', 'semi_finished', 'finishing'], ['compound', 'Mivida', 'compound'], ['district', 'Sheikh Zayed', 'district'],
    ['listing_type', 'rent', 'listing_type'], ['property_type', 'villa', 'property_type'], ['delivery_year', '2028', 'delivery'],     ['down_payment_value', '600000', 'payment'], ['owner_name', 'Ali', 'owner_name'],
  ])('a different %s is a change (%s)', (field, value, group) => {
    expect(changedFields(stored, { [field]: value })).toEqual([group]);
  });
  it('a post that only brings notes, description or English summary is unchanged', () => {
    expect(changedFields(stored, { notes: 'WhatsApp · Ahmed · 24/10/2026', clean_summary: 'brand new text', summary_en: 'new en' })).toEqual([]);
  });
  it('the owner phone, readiness, features and market are never a change (a stored unit keeps them)', () => {
    expect(changedFields(stored, { ...stored, owner_phone: '01099999999', is_ready: '0', feature: ['pool'], market: 'resale' })).toEqual([]);
  });
  it('a district the unit already has under another stored name is not a change', () => {
    expect(changedFields({ ...stored, city: 'Cairo' }, { district: 'cairo' })).toEqual([]);
  });
});

describe('kinds, ticks, counts and what is saved', () => {
  const badges = [upd, upd, none, { kind: 'taken' } as CodeBadge, none];
  const list = [
    mk('1', { existing: { version: 1, fields: stored }, fields: { ...stored, notes: 'n' } }), // unchanged
    mk('2', { existing: { version: 1, fields: stored }, fields: { ...stored, price_value: '9000000' } }), // updated
    mk('3'), // new
    mk('4'), // taken: error
    mk('5', { missing: ['compound'] }), // incomplete: error
  ];

  it('kindOf: unchanged, updated, new, error, discarded, saved', () => {
    expect(list.map((p, i) => kindOf(p, badges[i]))).toEqual(['unchanged', 'updated', 'new', 'error', 'error']);
    expect(kindOf({ ...list[2], discarded: true }, none)).toBe('discarded');
    expect(kindOf({ ...list[2], state: 'saved' }, none)).toBe('saved');
    expect(kindOf({ ...list[2], fields: undefined }, none)).toBe('error');
    expect(kindOf({ ...list[1], existing: null }, upd)).toBe('error'); // the stored unit could not be read: never saved blind
  });

  it('default ticks: only valid new or changed units', () => {
    expect(withDefaultTicks(list, badges).map((p) => p.picked)).toEqual([false, true, true, false, false]);
  });

  it('counts: will save (new, updated) and skipping (errors, unchanged, discarded, unticked)', () => {
    const ticked = withDefaultTicks(list, badges);
    const c = importCounts([...ticked, mk('6', { discarded: true, picked: false })], [...badges, none]);
    expect(c).toMatchObject({ willSave: 2, newCount: 1, updated: 1, errors: 2, unchanged: 1, discarded: 1, unticked: 0, skipped: 4, remaining: 5 });
    const c2 = importCounts(ticked.map((p, i) => (i === 2 ? { ...p, picked: false } : p)), badges);
    expect(c2).toMatchObject({ willSave: 1, unticked: 1, skipped: 4 });
  });

  it('save skips errors, unchanged and discarded units even when ticked', () => {
    const allTicked = list.map((p) => ({ ...p, picked: true }));
    expect(allTicked.map((p, i) => savable(p, badges[i]))).toEqual([false, true, true, false, false]);
    expect(savable({ ...allTicked[2], discarded: true }, none)).toBe(false);
    expect(savable({ ...allTicked[2], picked: false }, none)).toBe(false);
  });

  it('errors do not block the others: counts never gate on errors', () => {
    const c = importCounts([mk('1'), mk('2', { missing: ['x'] })], [none, none]);
    expect(c.willSave).toBe(1);
    expect(c.errors).toBe(1);
  });

  it('counts leave saved posts out of remaining and photos', () => {
    const photos = Array.from({ length: 2 }, (_, k) => ({ uri: `u${k}`, name: `n${k}`, type: 'image/jpeg' }));
    const c = importCounts([mk('1', { photos }), mk('2', { state: 'saved', photos })], [none, none]);
    expect(c).toMatchObject({ total: 2, saved: 1, remaining: 1, photos: 2 });
  });
});

describe('errors', () => {
  it('hasError: incomplete, taken, dup, needs_edit; discard clears it; saved never errors; an update is not an error', () => {
    expect(hasError(mk('1', { missing: ['x'] }), none)).toBe(true);
    expect(hasError(mk('1'), { kind: 'taken' })).toBe(true);
    expect(hasError(mk('1'), { kind: 'dup', of: 1 })).toBe(true);
    expect(hasError(mk('1', { state: 'needs_edit' }), none)).toBe(true);
    expect(hasError(mk('1', { missing: ['x'], discarded: true }), none)).toBe(false);
    expect(hasError(mk('1', { state: 'saved', missing: ['x'] }), none)).toBe(false);
    expect(hasError(mk('1', { existing: { version: 1, fields: {} } }), upd)).toBe(false);
    expect(hasError(mk('1', { existing: null }), upd)).toBe(true);
    expect(hasError(mk('1', { existing: { version: 1, fields: {} }, blocker: 'other_unit' }), upd)).toBe(true);
    expect(blockedByCode({ kind: 'taken' })).toBe(true);
  });
  it('a field the existing unit already has is not missing for an update post', () => {
    const p = mk('1', { missing: ['owner_phone', 'compound'], existing: { version: 1, fields: { owner_phone: '01012345678' } } });
    expect(missingFor(p)).toEqual(['compound']);
    expect(incomplete(p)).toBe(true);
    expect(incomplete({ ...p, missing: ['owner_phone'] })).toBe(false);
  });
});

describe('owner phone only from the post text', () => {
  test('a phone not written in the post is dropped (sender, default, stale)', () => {
    expect(withTextPhoneOnly({ listing_type: 'sale', owner_phone: '01012345622' }, 'شقة للبيع 150 متر')).toEqual({ listing_type: 'sale' });
  });
  test('spaces and dashes are removed only between digits within a line; every phone of the text counts', () => {
    const f = { owner_phone: '01012345622' };
    expect(withTextPhoneOnly(f, 'للتواصل 0101-234-5622 او 01199999999')).toBe(f);
    expect(withTextPhoneOnly(f, 'اتصل 01199999999 او 0101 234 5622')).toBe(f);
    // digits on two lines are never glued into a phone
    expect(withTextPhoneOnly(f, 'السعر 0101\n2345622')).toEqual({});
  });
  test('a phone written in the post is kept', () => {
    const f = { owner_phone: '01012345622' };
    expect(withTextPhoneOnly(f, 'شقة للبيع 0101 234 5622')).toBe(f);
    expect(withTextPhoneOnly(f, 'شقة +201012345622')).toBe(f);
  });
});

describe('the update overlay (only what the post really changes)', () => {
  // A realistic chat-read fixture: the reader adds market, is_ready:false, feature:[] and the WhatsApp note on every post.
  const chatRead = { price_value: '9500000', area_value: '150', bedrooms: '3', listing_type: 'sale', property_type: 'apartment', compound: 'Hyde Park', owner_phone: '01099999999', market: 'resale', is_ready: false, feature: [] as string[], notes: 'WhatsApp', clean_summary: 'new text' };
  const unit = { ...stored, market: 'primary', is_ready: '1', feature: ['pool'], notes: 'old note', clean_summary: 'old text' };

  it('overlays only changed keys; never market, readiness, features, summary or the stored phone; appends the note', () => {
    const body = overlayUpdate(unit, chatRead);
    expect(body).toMatchObject({ price_value: '9500000', market: 'primary', is_ready: '1', feature: ['pool'], clean_summary: 'old text', owner_phone: '01012345678', area_value: '150', summary_en: 'old en' });
    expect(body.notes).toBe('old note\nWhatsApp');
    expect(overlayUpdate(unit, { ...chatRead, notes: 'old note' }).notes).toBe('old note');
  });
  it('false and empty lists are "not stated" for readiness and features', () => {
    expect(comparable('is_ready', false)).toBe('');
    expect(comparable('feature', [])).toBe('');
    expect(changedFields(unit, { is_ready: false, feature: [] })).toEqual([]);
  });
  it('Arabic spellings fold in a place compare, and the stored English name / ids count', () => {
    expect(changedFields({ ...stored, compound: 'مدينة نصر', district: undefined }, { compound: 'مدينه نصر' })).toEqual([]);
    expect(changedFields({ ...stored, compound: 'التجمع', district: undefined }, { compound: 'إلتجمع' })).toEqual([]);
    expect(foldArabic('أإآ ة ى')).toBe('ااا ه ي');
    expect(changedFields({ ...stored, compound: 'هايد بارك', compound_en: 'Hyde Park' }, { compound: 'hyde park' })).toEqual([]);
    expect(changedFields({ ...stored, compound: undefined, district: undefined, compound_ids: ['Mivida'] }, { compound: 'mivida' })).toEqual([]);
  });
});

describe('the code may belong to another unit, or the unit is newer', () => {
  const ex = { version: 1, fields: stored };
  it('a clear conflict of type, deal or place is "other_unit"', () => {
    expect(existingBlocker(ex, { property_type: 'villa' }, null)).toBe('other_unit');
    expect(existingBlocker(ex, { listing_type: 'rent' }, null)).toBe('other_unit');
    expect(existingBlocker(ex, { compound: 'Mivida' }, null)).toBe('other_unit');
    expect(existingBlocker(ex, { compound: 'hyde park', property_type: 'apartment', price_value: '1' }, null)).toBeUndefined();
    expect(existingBlocker(ex, { price_value: '9000000' }, null)).toBeUndefined();
  });
  it('a unit updated after the post is "older"', () => {
    expect(existingBlocker({ ...ex, updatedAt: 2000 }, { price_value: '1' }, 1000)).toBe('older');
    expect(existingBlocker({ ...ex, updatedAt: 500 }, { price_value: '1' }, 1000)).toBeUndefined();
    expect(toExisting({ version: 3, fields: {}, updated_at: '2026-10-24T10:00:00Z' }).updatedAt).toBe(Date.parse('2026-10-24T10:00:00Z'));
    expect(toExisting({ version: 3, fields: {} }).updatedAt).toBeUndefined();
  });
});

describe('owner implied, repeats, bulk skips, photo room', () => {
  it('a phone with no name stands in for the name; the name is not missing then', () => {
    expect(withImpliedOwner({ owner_phone: '01012345678' })).toMatchObject({ owner_name_from_phone: '1' });
    expect(withImpliedOwner({ owner_phone: '01012345678', owner_name: 'Omar' }).owner_name_from_phone).toBeUndefined();
    expect(withImpliedOwner({}).owner_name_from_phone).toBeUndefined();
    expect(missingFor(mk('1', { missing: ['owner_name', 'compound'], fields: { owner_phone: '01012345678' } }))).toEqual(['compound']);
    expect(missingFor(mk('1', { missing: ['owner_name'], fields: {} }))).toEqual(['owner_name']);
  });
  it('repeat codes: HP-12 equals HP12, a discarded or saved post never counts, the newest stands', () => {
    const a = mk('1', { post: { code: 'HP-12' } as never });
    const b = mk('2', { post: { code: 'hp12' } as never });
    expect(normCode('HP-12')).toBe(normCode('hp 12'));
    expect(codeBadge([a, b], 0, null, 'done')).toEqual({ kind: 'dup', of: 2 });
    expect(codeBadge([a, b], 1, null, 'done')).toEqual({ kind: 'none' });
    expect(codeBadge([a, { ...b, discarded: true }], 0, null, 'done')).toEqual({ kind: 'none' });
    expect(codeBadge([{ ...a, state: 'saved' }, b], 1, null, 'done')).toEqual({ kind: 'none' });
  });
  it('bulk fixes skip an update whose stored unit already has the field, and never give a stored unit a phone', () => {
    const p = mk('1', { fields: {}, existing: { version: 1, fields: { listing_type: 'sale', owner_phone: '01012345678' } } });
    expect(lacksDealType(p)).toBe(false);
    expect(lacksOwnerPhone(p)).toBe(false);
    expect(lacksDealType(mk('1', { fields: {}, existing: { version: 1, fields: {} } }))).toBe(true);
    expect(lacksOwnerPhone(mk('1', { fields: {} }))).toBe(true);
  });
  it('an update may add only what is left of the 15 photos', () => {
    expect(updatePhotoRoom(0)).toBe(15);
    expect(updatePhotoRoom(12)).toBe(3);
    expect(updatePhotoRoom(20)).toBe(0);
  });
});

describe('the range step helpers', () => {
  it('dates: Arabic digits, D/M/Y and a time are read; an invalid or empty one is null (never "all")', () => {
    expect(parseDateInput('2026-10-24')).toBe('2026-10-24');
    expect(parseDateInput('٢٠٢٦-١٠-٢٤')).toBe('2026-10-24');
    expect(parseDateInput('24/10/2026')).toBe('2026-10-24');
    expect(parseDateInput('2026-10-24 18:30')).toBe('2026-10-24T18:30');
    expect(parseDateInput('2026-02-30')).toBeNull();
    expect(parseDateInput('2026-13-01')).toBeNull();
    expect(parseDateInput('2026-10-24 25:00')).toBeNull();
    expect(parseDateInput('')).toBeNull();
    expect(parseDateInput('soon')).toBeNull();
  });
  it('resolveRange: presets, last import (just after the watermark), all, and a custom range that must be valid', () => {
    const now = Date.UTC(2026, 10, 19, 12);
    expect(resolveRange({ kind: 'all' }, null, now)).toEqual({ ok: true, since: undefined, until: undefined });
    expect(resolveRange({ kind: 'last' }, 5000, now)).toEqual({ ok: true, since: 5001, until: undefined });
    const r = resolveRange({ kind: '7' }, null, now);
    expect(r.ok && typeof r.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.since)).toBe(true);
    expect(resolveRange({ kind: 'custom', sinceText: '' }, null, now)).toEqual({ ok: false, error: 'since' });
    expect(resolveRange({ kind: 'custom', sinceText: 'xx' }, null, now)).toEqual({ ok: false, error: 'since' });
    expect(resolveRange({ kind: 'custom', sinceText: '2026-10-01', untilText: 'zz' }, null, now)).toEqual({ ok: false, error: 'until' });
    expect(resolveRange({ kind: 'custom', sinceText: '2026-10-10', untilText: '2026-10-01' }, null, now)).toEqual({ ok: false, error: 'order' });
    expect(resolveRange({ kind: 'custom', sinceText: '2026-10-01', untilText: '2026-10-05' }, null, now)).toEqual({ ok: true, since: '2026-10-01', until: '2026-10-05T23:59' });
  });
  it('counts the chat per day inside the range', () => {
    const perDay = { '2026-10-01': 5, '2026-10-02': 7, '2026-10-03': 2 };
    expect(countInRange(perDay)).toBe(14);
    expect(countInRange(perDay, '2026-10-02')).toBe(9);
    expect(countInRange(perDay, '2026-10-02', '2026-10-02T23:59')).toBe(7);
  });
  it('the watermark is the newest decided post time (saved, discarded, unchanged), and only moves forward', async () => {
    const at = (d: string) => ({ at: d } as never);
    const list = [mk('1', { post: at('01/10/2026 10:00'), state: 'saved' }), mk('2', { post: at('05/10/2026 10:00'), discarded: true }), mk('3', { post: at('09/10/2026 10:00') })];
    const t = newestDecided(list, [none, none, none]);
    expect(t).toBe(Date.UTC(2026, 9, 5, 10, 0));
    await advanceWatermark('b1', 'fp', 100);
    await advanceWatermark('b1', 'fp', 50);
    expect(await loadWatermark('b1', 'fp')).toBe(100);
    await saveAttached('b1', 'fp', 'HP-1', ['a.jpg']);
    expect(await loadAttached('b1', 'fp', 'hp1')).toEqual(['a.jpg']);
  });
});
