import React from 'react';
import { Text, TextInput } from 'react-native';
import type { TextInputProps, TextProps } from 'react-native';
import { withBrandFont } from '../fonts';

// In RN 0.88 Text and TextInput are function components, so a render patch or defaultProps cannot reach them.
// These wrappers apply the brand font and cap the phone's text-size setting at 1.5x (callers can override).

/** Text in the brand font. Phone text-size settings are followed, capped at 1.5x. */
export function AppText({ style, maxFontSizeMultiplier = 1.5, ref, ...rest }: TextProps & { ref?: React.Ref<React.ComponentRef<typeof Text>> }) {
  return <Text ref={ref} {...rest} maxFontSizeMultiplier={maxFontSizeMultiplier} style={withBrandFont(style)} />;
}

/** TextInput in the brand font, with the same text-size cap as AppText. */
export function AppTextInput({ style, maxFontSizeMultiplier = 1.5, ref, ...rest }: TextInputProps & { ref?: React.Ref<React.ComponentRef<typeof TextInput>> }) {
  return <TextInput ref={ref} {...rest} maxFontSizeMultiplier={maxFontSizeMultiplier} style={withBrandFont(style)} />;
}
