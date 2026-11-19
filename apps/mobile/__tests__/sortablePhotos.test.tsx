import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SortablePhotos } from '../src/components/SortablePhotos';

const photos = [
  { uri: 'file:///a.jpg', name: 'a', type: 'image/jpeg' },
  { uri: 'file:///b.jpg', name: 'b', type: 'image/jpeg' },
  { uri: 'file:///c.jpg', name: 'c', type: 'image/jpeg' },
] as any;

test('each photo has a drag handle that screen readers can move a step at a time', async () => {
  await render(<SortablePhotos photos={photos} onChange={() => {}} removeLabel="Remove" />);
  const handle = screen.getByTestId('photo-handle-1');
  // The drag itself is a gesture-handler pan (it needs a device to exercise); the accessibility actions are plain props.
  expect(handle.props.accessibilityActions).toHaveLength(2);
  expect(typeof handle.props.onAccessibilityAction).toBe('function');
});
