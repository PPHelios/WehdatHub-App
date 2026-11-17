import { useColorScheme } from 'react-native';
import { COLORS, SHAPE } from '@wehdathub/shared';
import { usePrefs } from './prefs';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;

/** Card elevation: soft shadow on iOS, `elevation` on Android (needs the card's solid background). Spread into a card style. */
export const lift = { shadowColor: '#0B1F3A', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 } as const;

/** Button sizes (same as the website): small 40, medium 48, large 56. */
export const buttonHeight = { sm: SHAPE['btn-sm'], md: SHAPE['btn-md'], lg: SHAPE['btn-lg'] } as const;
export const buttonRadius = SHAPE['radius-btn'];

export function useTheme() {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const appearance = usePrefs((s) => s.appearance);
  const scheme = appearance === 'system' ? system : appearance;
  const c = COLORS[scheme];
  return {
    scheme,
    colors: {
      bg: c.bg,
      text: c.ink,
      // Main colour: azure in light, copper in dark. The second colour is the other one.
      primary: c.brand,
      onPrimary: c['on-brand'],
      accent: c.accent,
      onAccent: c['on-accent'],
      card: c.card,
      border: c.line,
      muted: c.muted,
      danger: c.bad,
      onDanger: c['on-bad'],
    },
  };
}
export type Theme = ReturnType<typeof useTheme>;
