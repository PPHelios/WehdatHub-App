import { describe, expect, it } from 'vitest';
import { dropIndex, moveItem } from './list';
import { isOutdated } from './validation';

describe('moveItem', () => {
  it('moves forward and backward without changing the input', () => {
    const a = ['a', 'b', 'c', 'd'];
    expect(moveItem(a, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(a, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(a).toEqual(['a', 'b', 'c', 'd']);
  });
  it('clamps the target and ignores a bad source', () => {
    expect(moveItem(['a', 'b'], 0, 9)).toEqual(['b', 'a']);
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });
});

describe('dropIndex', () => {
  it('rounds the drag distance to a row and stays inside the list', () => {
    expect(dropIndex(1, 80, 72, 5)).toBe(2);
    expect(dropIndex(1, 30, 72, 5)).toBe(1);
    expect(dropIndex(1, -500, 72, 5)).toBe(0);
    expect(dropIndex(3, 500, 72, 5)).toBe(4);
  });
});

describe('isOutdated', () => {
  it('compares versions part by part', () => {
    expect(isOutdated('0.1.0', '0.2.0')).toBe(true);
    expect(isOutdated('1.0.0', '0.9.9')).toBe(false);
    expect(isOutdated('1.2.3', '1.2.3')).toBe(false);
    expect(isOutdated('1.2.3', 'garbage')).toBe(false);
  });
});
