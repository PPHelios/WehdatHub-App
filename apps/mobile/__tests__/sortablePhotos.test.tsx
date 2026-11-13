import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SortablePhotos } from '../src/components/SortablePhotos';

const photos = [
  { uri: 'file:///a.jpg', name: 'a', type: 'image/jpeg' },
  { uri: 'file:///b.jpg', name: 'b', type: 'image/jpeg' },
  { uri: 'file:///c.jpg', name: 'c', type: 'image/jpeg' },
] as any;

test('the photo handle claims the drag before the page scrolls, so a short finger move still reorders', () => {
  render(<SortablePhotos photos={photos} onChange={() => {}} removeLabel="Remove" />);
  const handle = screen.getByTestId('photo-handle-1');
  expect(handle.props.onMoveShouldSetResponderCapture()).toBe(true);
  expect(handle.props.onStartShouldSetResponder()).toBe(true);
});
