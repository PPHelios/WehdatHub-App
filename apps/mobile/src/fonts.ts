import { StyleSheet, Text, TextInput } from 'react-native';
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

/** Every Text and TextInput in the app uses the brand font, without touching each screen. Safe to call twice. */
export function installBrandFont(): void {
  for (const C of [Text, TextInput] as unknown as { render?: (p: { style?: StyleProp<TextStyle> }, r: unknown) => unknown; branded?: boolean }[]) {
    const orig = C.render;
    if (!orig || C.branded) continue;
    C.render = function render(this: unknown, props, ref) {
      return orig.call(this, { ...props, style: withBrandFont(props.style) }, ref);
    };
    C.branded = true;
  }
}
