import React from 'react';
import { FlatList, I18nManager } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PhotoGallery } from '../src/components/PhotoGallery';

const photos = Array.from({ length: 15 }, (_, i) => ({ id: String(i), url: `https://x/${i}.jpg` }));
const width = 320;

async function layout(id: string) {
  await fireEvent(screen.getByTestId(`${id}-layout`), 'layout', { nativeEvent: { layout: { width } } });
}

async function settle(id: string, page: number) {
  await fireEvent(screen.getByTestId(id), 'momentumScrollEnd', {
    nativeEvent: {
      contentOffset: { x: (I18nManager.isRTL ? photos.length + 1 - page : page) * width },
      contentSize: { width: (photos.length + 2) * width },
      layoutMeasurement: { width },
    },
  });
}

afterEach(() => jest.restoreAllMocks());

test('opens the tapped photo full screen and closes the viewer', async () => {
  await render(<PhotoGallery photos={photos} closeLabel="Close" />);
  await layout('gallery');
  await fireEvent.press(screen.getByTestId('photo-1'));
  await layout('gallery-full');
  expect(screen.getByTestId('gallery-full').props.initialScrollIndex).toBe(2);
  expect(screen.getByText('2 / 15')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('photo-close'));
  expect(screen.queryByTestId('gallery-full')).toBeNull();
});

test.each([false, true])('wraps in both directions inline and fullscreen (RTL=%s)', async (rtl) => {
  jest.replaceProperty(I18nManager, 'isRTL', rtl);
  const scroll = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
  await render(<PhotoGallery photos={photos} closeLabel="Close" />);
  await layout('gallery');
  for (const id of ['gallery', 'gallery-full']) {
    if (id === 'gallery-full') {
      await fireEvent.press(screen.getByTestId('photo-0'));
      await layout(id);
    }
    const pager = screen.getByTestId(id);
    expect(pager.props.data).toEqual([photos[14], ...photos, photos[0]]);
    expect(pager.props.initialScrollIndex).toBe(1);
    await settle(id, 0);
    expect(screen.getByText('15 / 15')).toBeTruthy();
    expect(scroll).toHaveBeenLastCalledWith({ index: 15, animated: false });
    await settle(id, 16);
    expect(screen.getAllByText('1 / 15')).toHaveLength(id === 'gallery' ? 1 : 2);
    expect(scroll).toHaveBeenLastCalledWith({ index: 1, animated: false });
  }
});

test('one photo opens without enabling paging', async () => {
  await render(<PhotoGallery photos={photos.slice(0, 1)} closeLabel="Close" />);
  await layout('gallery');
  expect(screen.getByTestId('gallery').props.scrollEnabled).toBe(false);
  await fireEvent.press(screen.getByTestId('photo-0'));
  await layout('gallery-full');
  expect(screen.getByTestId('gallery-full').props.scrollEnabled).toBe(false);
});

test('renders nothing without photos', async () => {
  await render(<PhotoGallery photos={[]} closeLabel="Close" />);
  expect(screen.queryByTestId('gallery-layout')).toBeNull();
});
