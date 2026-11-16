import { classifyShare } from '../src/share';

// Plan item 16: odd things another app can hand over. Nothing may throw; what cannot be used is dropped.
describe('classifyShare with odd input', () => {
  test('nothing, an empty share and blank text give null', () => {
    expect(classifyShare(null)).toBeNull();
    expect(classifyShare({})).toBeNull();
    expect(classifyShare({ text: '   \n ', files: [] })).toBeNull();
    expect(classifyShare({ text: null, files: undefined })).toBeNull();
  });

  test('files with no type or name are named and dropped when not usable', () => {
    expect(classifyShare({ files: [{ uri: 'file:///a' }, { uri: 'file:///b', mimeType: '' }] })).toBeNull();
    expect(classifyShare({ files: [{ uri: 'file:///a', mimeType: 'application/pdf', name: 'x.pdf' }] })).toBeNull();
  });

  test('a zip is found by name when the phone gives no type, and only the first one is kept', () => {
    const out = classifyShare({ files: [{ uri: 'file:///c1', name: 'WhatsApp Chat - Team.zip' }, { uri: 'file:///c2', name: 'Other.zip', mimeType: 'application/zip' }] });
    expect(out?.zip?.uri).toBe('file:///c1');
    expect(out?.zip?.type).toBe('application/zip');
    expect(out?.photos).toBeUndefined();
  });

  test('an upper-case type is read, and a voice note keeps only the first', () => {
    const out = classifyShare({ files: [{ uri: 'u1', mimeType: 'IMAGE/JPEG' }, { uri: 'u2', mimeType: 'audio/opus' }, { uri: 'u3', mimeType: 'audio/ogg' }] });
    expect(out?.photos).toHaveLength(1);
    expect(out?.voice).toMatchObject({ uri: 'u2', type: 'audio/ogg' });
  });

  test('a share with text and a photo keeps both; a script in the text is only text', () => {
    const out = classifyShare({ text: '  <script>x</script> شقة  ', files: [{ uri: 'u1', mimeType: 'image/png', name: 'p.png' }] });
    expect(out?.text).toBe('<script>x</script> شقة');
    expect(out?.photos?.[0]).toMatchObject({ uri: 'u1', name: 'p.png' });
  });

  test('a hundred photos are all kept in order (the screen caps them, not the sorter)', () => {
    const files = Array.from({ length: 100 }, (_, i) => ({ uri: `u${i}`, mimeType: 'image/jpeg' }));
    const out = classifyShare({ files });
    expect(out?.photos).toHaveLength(100);
    expect(out?.photos?.[99].uri).toBe('u99');
  });
});
