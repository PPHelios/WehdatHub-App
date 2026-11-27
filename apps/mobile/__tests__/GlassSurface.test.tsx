import React from 'react';
import { Platform, Text } from 'react-native';
import { render } from '@testing-library/react-native';

const glass = require('@callstack/liquid-glass');
const { GlassSurface } = require('../src/components/GlassSurface');

const setPlatform = (os: string, v: number | string) => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
  Object.defineProperty(Platform, 'Version', { get: () => v, configurable: true });
};
const rendered = async (tid: string) => (await render(<GlassSurface testID={tid}><Text>x</Text></GlassSurface>)).getByTestId(tid);
const isFallback = (n: { props: { style?: unknown } }) => String(JSON.stringify(n.props.style)).includes('borderWidth');

describe('GlassSurface', () => {
  it('falls back to the solid card on Android', async () => {
    setPlatform('android', 34);
    glass.isLiquidGlassSupported = true;
    expect(isFallback(await rendered('a'))).toBe(true);
  });
  it('falls back on iOS 25', async () => {
    setPlatform('ios', '25.4');
    glass.isLiquidGlassSupported = true;
    expect(isFallback(await rendered('b'))).toBe(true);
  });
  it('falls back when the library reports no support', async () => {
    setPlatform('ios', '26.0');
    glass.isLiquidGlassSupported = false;
    expect(isFallback(await rendered('c'))).toBe(true);
  });
  it('uses glass on iOS 26 when supported', async () => {
    setPlatform('ios', '26.0');
    glass.isLiquidGlassSupported = true;
    expect(isFallback(await rendered('d'))).toBe(false);
  });
});
