import { classifyShare } from '../src/share';

// Share to the app is only for a WhatsApp "Export chat" zip. Nothing else may throw or be taken.
describe('classifyShare: only a chat zip', () => {
  test('nothing or an empty share gives null', () => {
    expect(classifyShare(null)).toBeNull();
    expect(classifyShare({})).toBeNull();
    expect(classifyShare({ files: [] })).toBeNull();
    expect(classifyShare({ files: undefined })).toBeNull();
  });

  test('a zip is found by mime type', () => {
    const out = classifyShare({ files: [{ uri: 'file:///c', mimeType: 'application/zip', name: 'chat' }] });
    expect(out).toEqual({ zip: { uri: 'file:///c', name: 'chat', type: 'application/zip' } });
  });

  test('a zip is found by .zip name when the phone gives no type', () => {
    const out = classifyShare({ files: [{ uri: 'file:///c', name: 'Team.zip' }, { uri: 'file:///d', mimeType: '', name: 'Other.zip' }] });
    expect(out?.zip?.uri).toBe('file:///c');
    expect(out?.zip?.type).toBe('application/zip');
  });

  test('a zip is found by the "WhatsApp Chat" name', () => {
    const out = classifyShare({ files: [{ uri: 'file:///c', mimeType: 'application/octet-stream', name: 'WhatsApp Chat with Sam' }] });
    expect(out?.zip).toEqual({ uri: 'file:///c', name: 'WhatsApp Chat with Sam', type: 'application/zip' });
  });

  test('photos, voice notes, text-only and other files give null', () => {
    expect(classifyShare({ files: [{ uri: 'p', mimeType: 'image/jpeg', name: 'a.jpg' }] })).toBeNull();
    expect(classifyShare({ files: [{ uri: 'v', mimeType: 'audio/ogg', name: 'PTT-1.opus' }] })).toBeNull();
    expect(classifyShare({ files: [{ uri: 'f', mimeType: 'application/pdf', name: 'x.pdf' }, { uri: 'g' }] })).toBeNull();
    expect(classifyShare({ text: 'hello', files: [] } as never)).toBeNull();
  });

  test('a photo named like a chat is not the zip', () => {
    expect(classifyShare({ files: [{ uri: 'p', mimeType: 'image/jpeg', name: 'WhatsApp Chat photo.jpg' }] })).toBeNull();
  });

  test('a mixed share with a zip and photos returns only the zip', () => {
    const out = classifyShare({ files: [{ uri: 'p', mimeType: 'image/jpeg' }, { uri: 'z', mimeType: 'application/x-zip-compressed', name: 'WhatsApp Chat with Sam.zip' }, { uri: 'v', mimeType: 'audio/ogg' }] });
    expect(out).toEqual({ zip: { uri: 'z', name: 'WhatsApp Chat with Sam.zip', type: 'application/zip' } });
  });
});
