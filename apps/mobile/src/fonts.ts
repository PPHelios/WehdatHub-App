import { StyleSheet } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

export const FONT_REGULAR = 'Cairo-Regular';
export const FONT_BOLD = 'Cairo-Bold';

/** Adds the brand font to a text style: Cairo Bold for weights from 600 up, Cairo Regular otherwise. A style that names its own font is left alone. */
export function withBrandFont(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return style;
  const w = flat.fontWeight;
  const bold = w === 'bold' || (w !== undefined && Number(w) >= 600);
  return [style, { fontFamily: bold ? FONT_BOLD : FONT_REGULAR, fontWeight: 'normal' }];
}
