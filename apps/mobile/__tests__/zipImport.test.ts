import { saysNotZip, unpackChat, ZipImportError } from '../src/zipImport';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { isPasswordProtected, listContents, unzip } from 'react-native-zip-archive';

jest.mock('react-native-zip-archive', () => ({ cancel: jest.fn(), isPasswordProtected: jest.fn(), listContents: jest.fn(), subscribe: jest.fn(() => ({ remove: jest.fn() })), unzip: jest.fn() }));
jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache', stat: jest.fn(), getFSInfo: jest.fn(), mkdir: jest.fn(), readFile: jest.fn(), copyFile: jest.fn(), unlink: jest.fn(),
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
