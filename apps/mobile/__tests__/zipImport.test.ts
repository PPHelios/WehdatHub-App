import { chatCandidates, findChatText, openChat, readChat, saysNotZip, scanChat, sweepWaImportCache, unpackChat, ZipImportError } from '../src/zipImport';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { isPasswordProtected, listContents, unzip } from 'react-native-zip-archive';

jest.mock('react-native-zip-archive', () => ({ cancel: jest.fn(), isPasswordProtected: jest.fn(), listContents: jest.fn(), subscribe: jest.fn(() => ({ remove: jest.fn() })), unzip: jest.fn() }));
jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache', stat: jest.fn(), getFSInfo: jest.fn(), mkdir: jest.fn(), readFile: jest.fn(), copyFile: jest.fn(), unlink: jest.fn(), readDir: jest.fn(),
}));

const fs = RNFS as unknown as Record<string, jest.Mock>;
const zipLib = { isPasswordProtected: isPasswordProtected as jest.Mock, listContents: listContents as jest.Mock, unzip: unzip as jest.Mock };
const chat = '24/10/2026, 10:00 - Ahmed: شقة كود HP-1 للبيع 150 متر 3 غرف السعر 8 مليون';

beforeEach(() => {
  jest.clearAllMocks();
  fs.stat.mockResolvedValue({ size: 1000 });
  fs.getFSInfo.mockResolvedValue({ freeSpace: 1e9 });
  fs.mkdir.mockResolvedValue(undefined);
  fs.copyFile.mockResolvedValue(undefined);
  fs.unlink.mockResolvedValue(undefined);
  fs.readFile.mockResolvedValue(chat);
  zipLib.isPasswordProtected.mockResolvedValue(false);
  zipLib.listContents.mockResolvedValue([{ path: '_chat.txt', size: 100, isDirectory: false }]);
  zipLib.unzip.mockResolvedValue(undefined);
});

describe('what counts as "not a zip"', () => {
  it('only the zip format\'s own words do: a path that ends in .zip or a missing file never does', () => {
    expect(saysNotZip('Not a valid zip file')).toBe(true);
    expect(saysNotZip('End of central directory signature not found')).toBe(true);
    expect(saysNotZip('/data/user/0/app/cache/WhatsApp Chat.zip: open failed: ENOENT (No such file or directory)')).toBe(false);
    expect(saysNotZip('Failed to read zip /storage/emulated/0/Download/chat.zip: Permission denied')).toBe(false);
    expect(saysNotZip('something failed')).toBe(false);
  });
});

describe('unpackChat', () => {
  it('a content:// file from the Android picker is copied into the cache first, read from there, and the copy is removed', async () => {
    const posts = await unpackChat('content://com.android.providers.downloads.documents/document/12', null, jest.fn());
    expect(fs.copyFile).toHaveBeenCalledWith('content://com.android.providers.downloads.documents/document/12', expect.stringMatching(/^\/cache\/wa-import-\d+\.zip$/));
    const local = fs.copyFile.mock.calls[0][1];
    expect(zipLib.isPasswordProtected).toHaveBeenCalledWith(local);
    expect(zipLib.listContents).toHaveBeenCalledWith(local);
    expect(posts.posts.length).toBeGreaterThan(0);
    expect(fs.unlink).toHaveBeenCalledWith(local);
  });

  it('a file:// path is read in place (no copy)', async () => {
    await unpackChat('file:///storage/emulated/0/Download/chat.zip', null, jest.fn());
    expect(fs.copyFile).not.toHaveBeenCalled();
    expect(zipLib.listContents).toHaveBeenCalledWith('/storage/emulated/0/Download/chat.zip');
  });

  it('a missing file is "failed", not "not a zip", even though its path ends in .zip; the detail has no path', async () => {
    zipLib.listContents.mockRejectedValue(new Error('/storage/emulated/0/Download/My Group.zip: open failed: ENOENT (No such file or directory)'));
    const err = await unpackChat('file:///storage/emulated/0/Download/My Group.zip', null, jest.fn()).catch((e) => e);
    expect(err).toBeInstanceOf(ZipImportError);
    expect(err.reason).toBe('failed');
    expect(err.detail).not.toMatch(/Group|storage/);
  });

  it('a file that really is not a zip is "not_zip"', async () => {
    zipLib.listContents.mockRejectedValue(new Error('Not a valid zip file'));
    const err = await unpackChat('file:///cache/x.zip', null, jest.fn()).catch((e) => e);
    expect(err.reason).toBe('not_zip');
  });
});

describe('chat file choice', () => {
  const e = (path: string, size = 10) => ({ path, size, isDirectory: false });
  it('prefers _chat.txt, then chat-like names, then the biggest', () => {
    expect(findChatText([e('notes.txt', 900), e('WhatsApp Chat - X.txt', 5), e('_chat.txt', 1)])?.path).toBe('_chat.txt');
    expect(findChatText([e('notes.txt', 900), e('محادثة واتساب.txt', 5)])?.path).toBe('محادثة واتساب.txt');
    expect(chatCandidates([e('a.txt', 5), e('b.txt', 50)]).map((x) => x.path)).toEqual(['b.txt', 'a.txt']);
  });
  it('skips a candidate whose first lines are not chat headers', async () => {
    zipLib.listContents.mockResolvedValue([{ path: 'WhatsApp readme.txt', size: 10, isDirectory: false }, { path: 'big.txt', size: 50, isDirectory: false }]);
    fs.readFile.mockResolvedValueOnce('hello this is a readme nothing here').mockResolvedValueOnce(chat);
    const o = await openChat('file:///cache/x.zip');
    expect(o.chatText).toBe(chat);
  });
  it('no header at all is no_chat', async () => {
    fs.readFile.mockResolvedValue('just words');
    const err = await openChat('file:///cache/x.zip').catch((x) => x);
    expect(err.reason).toBe('no_chat');
  });
});

describe('openChat', () => {
  it('scans the chat: first, last, total, per day, fingerprint without the group name', async () => {
    fs.readFile.mockResolvedValue(`${chat}
25/10/2026, 9:00 م - Sara: مرحبا
line two
[26/10/2026, 11:00:00] Omar: ok`);
    const o = await openChat('file:///cache/My Secret Group.zip');
    expect(o.info.total).toBe(3);
    expect(o.info.perDay).toEqual({ '2026-10-24': 1, '2026-10-25': 1, '2026-10-26': 1 });
    expect(o.info.firstAt).toBe(Date.UTC(2026, 9, 24, 10, 0));
    expect(o.info.lastAt).toBe(Date.UTC(2026, 9, 26, 11, 0));
    expect(o.info.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(scanChat(chat, '_chat.txt').fingerprint).toBe(scanChat(chat, '_chat.txt').fingerprint);
  });
  it('refuses a picker size over 1 GB before copying', async () => {
    const err = await openChat('content://x/1', { size: 2 * 1024 ** 3 } as never).catch((x) => x);
    expect(err.reason).toBe('too_big');
    expect(fs.copyFile).not.toHaveBeenCalled();
  });
  it('refuses with no_space before copying when the picker size is known', async () => {
    fs.getFSInfo.mockResolvedValue({ freeSpace: 1000 });
    const err = await openChat('content://x/1', { size: 1000 } as never).catch((x) => x);
    expect(err.reason).toBe('no_space');
    expect(fs.copyFile).not.toHaveBeenCalled();
  });
  it('cancel after the copy removes the copy', async () => {
    const signal = { cancelled: false };
    fs.copyFile.mockImplementation(async () => { signal.cancelled = true; });
    const err = await openChat('content://x/1', { signal }).catch((x) => x);
    expect(err.reason).toBe('cancelled');
    expect(fs.unlink).toHaveBeenCalledWith(expect.stringMatching(/wa-import-\d+\.zip$/));
  });
  it('close removes the copy and a shared zip, twice is fine', async () => {
    const o = await openChat('file:///cache/shared/1_WhatsApp_Chat.zip');
    await o.close();
    await o.close();
    expect(fs.unlink).toHaveBeenCalledWith('/cache/shared/1_WhatsApp_Chat.zip');
    fs.unlink.mockClear();
    const p = await openChat('file:///storage/emulated/0/Download/chat.zip');
    await p.close();
    expect(fs.unlink).not.toHaveBeenCalledWith('/storage/emulated/0/Download/chat.zip');
  });
});

describe('readChat', () => {
  it('without media unpacks nothing', async () => {
    const o = await openChat('file:///cache/x.zip');
    zipLib.unzip.mockClear();
    const r = await readChat(o, { withMedia: false });
    expect(zipLib.unzip).not.toHaveBeenCalled();
    expect(r.posts.length).toBeGreaterThan(0);
  });
  it('cancel mid-read cleans the photo folder', async () => {
    const o = await openChat('file:///cache/x.zip');
    const signal = { cancelled: false };
    fs.mkdir.mockImplementation(async () => { signal.cancelled = true; });
    const err = await readChat(o, { withMedia: true, signal }).catch((x) => x);
    expect(err.reason).toBe('cancelled');
    expect(fs.unlink).toHaveBeenCalledWith(expect.stringMatching(/^\/cache\/wa-import\/\d+$/));
  });
  it('close during a read cancels it', async () => {
    const o = await openChat('file:///cache/x.zip');
    await o.close();
    const err = await readChat(o, { withMedia: true }).catch((x) => x);
    expect(err.reason).toBe('cancelled');
  });
});

describe('sweepWaImportCache', () => {
  it('deletes only old wa-import items', async () => {
    const now = Date.now();
    fs.readDir.mockResolvedValue([
      { name: 'wa-import', path: '/cache/wa-import', mtime: new Date(now - 2 * 86400000) },
      { name: 'wa-import-1.zip', path: '/cache/wa-import-1.zip', mtime: new Date(now - 1000) },
      { name: 'other', path: '/cache/other', mtime: new Date(now - 9 * 86400000) },
    ]);
    await sweepWaImportCache(now);
    expect(fs.unlink).toHaveBeenCalledTimes(1);
    expect(fs.unlink).toHaveBeenCalledWith('/cache/wa-import');
  });
});
