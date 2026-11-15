import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Button } from '../src/components/Button';
import { SaveNotConfirmed, newSaveKey, withSaveCheck } from '../src/saveKey';

test('a save key is 24 letters and digits and differs each time', () => {
  const a = newSaveKey();
  expect(a).toMatch(/^[A-Za-z0-9]{24}$/);
  expect(newSaveKey()).not.toBe(a);
});

test('an answer inside the time is returned and the status is never asked', async () => {
  const check = jest.fn();
  expect(await withSaveCheck(Promise.resolve({ code: 'A1' }), check, 50)).toEqual({ code: 'A1' });
  expect(check).not.toHaveBeenCalled();
});

test('no answer in time: a saved key gives its code', async () => {
  const never = new Promise<{ code: string }>(() => undefined);
  const r = await withSaveCheck(never, async () => ({ saved: true, code: 'HP301' }), 10);
  expect(r).toEqual({ code: 'HP301', checked: true });
});

test('no answer in time and not saved: an error the screen can retry', async () => {
  const never = new Promise<{ code: string }>(() => undefined);
  await expect(withSaveCheck(never, async () => ({ saved: false }), 10)).rejects.toBeInstanceOf(SaveNotConfirmed);
});

test('the button shows the fill when given a progress', async () => {
  await render(<Button label="Saving 45%" progress={0.45} onPress={() => undefined} />);
  expect(screen.getByTestId('button-progress').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: '45%' })]));
});
