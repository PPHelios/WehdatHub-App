import { KEEP, blockedByCode, incomplete, buildImportPosts, codeBadge, findChatText, looksLikeZip, photoEntriesFor, readPosts, stagePct } from '../src/whatsappImport';

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
    expect(codeBadge(list, 0, { 'HP-1': { state: 'update', code: 'HP-1', photos: 4, status: 'active' } }, 'done')).toEqual({ kind: 'update', code: 'HP-1', photos: 4 });
    expect(codeBadge(list, 1, null, 'done')).toEqual({ kind: 'dup', of: 1 });
    expect(codeBadge(list, 0, { 'HP-1': { state: 'taken' } }, 'done')).toEqual({ kind: 'taken' });
    expect(codeBadge(list, 0, { 'HP-1': { state: 'new' } }, 'done')).toEqual({ kind: 'new', code: 'HP-1' });
    expect(codeBadge(list, 0, null, 'checking')).toEqual({ kind: 'checking' });
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
