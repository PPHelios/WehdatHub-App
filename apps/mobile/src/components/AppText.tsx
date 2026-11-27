import React from 'react';
import { Text, TextInput } from 'react-native';
import type { TextInputProps, TextProps } from 'react-native';
import { withBrandFont } from '../fonts';
import { typeScale } from '../theme';
import type { TypeVariant } from '../theme';

// In RN 0.88 Text and TextInput are function components, so a render patch or defaultProps cannot reach them.
// These wrappers apply the brand font and cap the phone's text-size setting at 1.5x (callers can override).

/** Text in the brand font. Phone text-size settings are followed, capped at 1.5x. `variant` sets size and line height from the type scale; `weight` overrides the variant's default weight. An explicit `style` wins. */
export function AppText({ style, variant, weight, maxFontSizeMultiplier = 1.5, ref, ...rest }: TextProps & { variant?: TypeVariant; weight?: 'regular' | 'bold'; ref?: React.Ref<React.ComponentRef<typeof Text>> }) {
  let s: TextProps['style'] = style;
  if (variant) {
    const { fontSize, lineHeight, bold } = typeScale[variant];
    s = [{ fontSize, lineHeight, fontWeight: (weight ? weight === 'bold' : bold) ? '700' : '400' }, style];
  } else if (weight) s = [{ fontWeight: weight === 'bold' ? '700' : '400' }, style];
  return <Text ref={ref} {...rest} maxFontSizeMultiplier={maxFontSizeMultiplier} style={withBrandFont(s)} />;
}

/** TextInput in the brand font, with the same text-size cap as AppText. */
export function AppTextInput({ style, maxFontSizeMultiplier = 1.5, ref, ...rest }: TextInputProps & { ref?: React.Ref<React.ComponentRef<typeof TextInput>> }) {
  return <TextInput ref={ref} {...rest} maxFontSizeMultiplier={maxFontSizeMultiplier} style={withBrandFont(style)} />;
}
