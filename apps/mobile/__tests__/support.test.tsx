import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { classifyShare } from '../src/share';
import { APP_VERSION } from '../src/config';
import { SortablePhotos } from '../src/components/SortablePhotos';
import { useLock } from '../src/lock';
import * as Keychain from 'react-native-keychain';

test('shared photos, a WhatsApp voice note and text are sorted for Add unit', () => {
  const s = classifyShare({ text: ' شقة ', files: [{ uri: 'file:///a.jpg', mimeType: 'image/jpeg' }, { uri: 'file:///v.opus', mimeType: 'audio/opus', name: 'PTT.opus' }, { uri: 'file:///x.pdf', mimeType: 'application/pdf' }] });
  expect(s?.photos).toHaveLength(1);
  expect(s?.voice).toMatchObject({ uri: 'file:///v.opus', type: 'audio/ogg' });
  expect(s?.text).toBe('شقة');
  expect(classifyShare({ files: [] })).toBeNull();
  expect(classifyShare(null)).toBeNull();
});

test('the app version matches package.json', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  expect(APP_VERSION).toBe(require('../package.json').version);
});

test('photos show in order with the cover first', async () => {
  await render(<SortablePhotos photos={[{ uri: 'file:///1.jpg', name: '1', type: 'image/jpeg' }, { uri: 'file:///2.jpg', name: '2', type: 'image/jpeg' }]} onChange={jest.fn()} removeLabel="Remove" />);
  expect(screen.getByTestId('photo-row-0')).toBeTruthy();
  expect(screen.getByTestId('photo-row-1')).toBeTruthy();
  expect(screen.getByText('★ 1')).toBeTruthy();
});

test('the app lock only opens when the phone lock check passes', async () => {
  useLock.setState({ enabled: true, locked: true });
  (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
  expect(await useLock.getState().unlock('x')).toBe(false);
  expect(useLock.getState().locked).toBe(true);
  (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({ username: 'lock', password: '1' });
  expect(await useLock.getState().unlock('x')).toBe(true);
  expect(useLock.getState().locked).toBe(false);
});
