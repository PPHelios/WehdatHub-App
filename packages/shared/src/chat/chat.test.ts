import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ChatMatch, ChatParse } from './index';

const T = (hh: number, mm: number) => `24/10/2026, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
const photo = (n: string, who = 'Ahmed', at = T(10, 14)) => `${at} - ${who}: IMG-${n}.jpg (file attached)`;
const say = (text: string, who = 'Ahmed', at = T(10, 15)) => `${at} - ${who}: ${text}`;
const post = (code: string) => `شقة ${code} للبيع في التجمع 200 متر 3 غرف السعر 12 مليون`;

describe('the shared WhatsApp chat reader', () => {
  it('places photos on the post next to them and reads the code the post writes', () => {
    const text = [photo('a'), photo('b'), say(post('كود HP-12'))].join('\n');
    const r = ChatMatch.match(text);
    expect(r.mode).toBe('posts');
    expect(r.posts).toHaveLength(1);
    expect(r.posts![0].code).toBe('HP-12');
    expect(r.posts![0].files.map((f) => f.name)).toEqual(['IMG-a.jpg', 'IMG-b.jpg']);
  });

  it('keeps up to 60 photos of a post (the person picks the 15) and counts the videos left out per post', () => {
    const lines = [say(post('HP-1'), 'Ahmed', T(10, 0))];
    for (let k = 1; k <= 20; k += 1) lines.push(photo(`p${k}`, 'Ahmed', T(10, 1)));
    lines.push(`${T(10, 2)} - Ahmed: VID-1.mp4 (file attached)`);
    const r = ChatMatch.match(lines.join('\n'));
    expect(r.posts![0].files).toHaveLength(20);
    expect(r.posts![0].over).toBe(0);
    expect(r.posts![0].videos).toBe(1);
    expect(r.stats.skippedMedia).toBe(1);
  });

  it('has a default start date and the 15-photo cap', () => {
    expect(ChatParse.defaultSince()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ChatParse.MAX_PHOTOS).toBe(15);
  });

  it('is the same code as the server (run `node scripts/sync-chat-domain.mjs` after changing the server files)', () => {
    const server = path.join(__dirname, '../../../../../WehdatHub-Server/domain/chatMatch.js');
    if (!fs.existsSync(server)) return; // the server repo is not next to this one (CI)
    const copy = fs.readFileSync(path.join(__dirname, 'chatMatch.ts'), 'utf8');
    const original = fs.readFileSync(server, 'utf8').replace(/\r\n/g, '\n');
    expect(copy.includes(original)).toBe(true);
  });
});
