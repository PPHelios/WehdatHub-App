import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PhotoGallery } from '../src/components/PhotoGallery';

const photos = [{ id: 'a', url: 'https://x/a.jpg' }, { id: 'b', url: 'https://x/b.jpg' }, { id: 'c', url: 'https://x/c.jpg' }];

test('shows the count and opens a photo full screen', async () => {
  await render(<PhotoGallery photos={photos} closeLabel="Close" />);
  expect(screen.getByText('1 / 3')).toBeTruthy();
  expect(screen.queryByTestId('photo-close')).toBeNull();
  await fireEvent.press(screen.getByTestId('photo-1'));
  expect(screen.getByTestId('photo-close')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('photo-close'));
  expect(screen.queryByTestId('photo-close')).toBeNull();
});

test('renders nothing without photos', async () => {
  await render(<PhotoGallery photos={[]} closeLabel="Close" />);
  expect(screen.queryByTestId('gallery')).toBeNull();
});
