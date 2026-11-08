import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders the brand name and a shared-formatted price', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const json = JSON.stringify(renderer.toJSON());
  expect(json).toContain('3,180,590');
  expect(json).toContain('Hub');
});
