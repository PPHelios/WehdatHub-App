import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Avatar } from '../src/components/Avatar';
import { AppSettings } from '../src/components/AppSettings';
import { api } from '../src/api';
import { useAuth } from '../src/auth';
import { toast } from '../src/components/Toast';

jest.mock('../src/api', () => ({ api: { appSettings: jest.fn(), uploadAvatar: jest.fn(), deleteAvatar: jest.fn() } }));
jest.mock('../src/photos', () => ({ pickPhotos: jest.fn(async () => [{ uri: 'file:///a.png', name: 'a.png', type: 'image/png' }]) }));
jest.mock('../src/compress', () => ({ compressPhoto: jest.fn(async (f: { uri: string }) => ({ ...f, uri: 'file:///small.jpg', type: 'image/jpeg' })) }));
jest.mock('../src/rights', () => ({ useRights: () => ({ manager: false, agencyOwner: false }) }));
jest.mock('../src/components/Toast', () => ({ toast: jest.fn() }));
const m = api as unknown as { appSettings: jest.Mock; uploadAvatar: jest.Mock; deleteAvatar: jest.Mock };

test('Avatar shows the photo when there is one, else the initials', async () => {
  const { rerender } = await render(<Avatar name="Sara Ali" uri="https://x/a.jpg" size={28} />);
  expect(screen.getByTestId('avatar-photo')).toBeTruthy();
  await rerender(<Avatar name="Sara Ali" uri={null} />);
  expect(screen.queryByTestId('avatar-photo')).toBeNull();
  expect(screen.getByText('SA', { includeHiddenElements: true })).toBeTruthy();
});

describe('profile photo', () => {
  const setAvatar = jest.fn(async () => undefined);
  beforeEach(() => {
    jest.clearAllMocks();
    m.appSettings.mockResolvedValue({ draftStyle: '', quietLine: true, switches: null });
    useAuth.setState({ broker: { id: 'b', name: 'Sara Ali', role: 'broker', lang: 'en', avatarUrl: null }, setAvatar });
  });
  const wrap = async () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AppSettings /></QueryClientProvider>);

  test('picks, compresses, uploads and tells the user', async () => {
    m.uploadAvatar.mockResolvedValue({ avatarUrl: 'https://x/new.jpg' });
    await wrap();
    await fireEvent.press(await screen.findByTestId('avatar-pick'));
    await waitFor(() => expect(m.uploadAvatar).toHaveBeenCalledWith({ uri: 'file:///small.jpg', name: 'a.png', type: 'image/jpeg' }));
    expect(setAvatar).toHaveBeenCalledWith('https://x/new.jpg');
    expect(toast).toHaveBeenCalledWith(expect.any(String));
  });

  test('a failed upload shows an error toast and keeps the old photo', async () => {
    m.uploadAvatar.mockRejectedValue(new Error('x'));
    await wrap();
    await fireEvent.press(await screen.findByTestId('avatar-pick'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.any(String), true));
    expect(setAvatar).not.toHaveBeenCalled();
  });

  test('remove only shows with a photo and deletes it', async () => {
    useAuth.setState({ broker: { id: 'b', name: 'Sara Ali', role: 'broker', lang: 'en', avatarUrl: 'https://x/a.jpg' } });
    m.deleteAvatar.mockResolvedValue({ avatarUrl: null });
    await wrap();
    await fireEvent.press(await screen.findByTestId('avatar-remove'));
    await waitFor(() => expect(setAvatar).toHaveBeenCalledWith(null));
  });
});
