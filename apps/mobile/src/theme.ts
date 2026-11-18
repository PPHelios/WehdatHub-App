import { useColorScheme } from 'react-native';
import { COLORS, SHAPE } from '@wehdathub/shared';
import { usePrefs } from './prefs';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, card: 16 } as const;

/** Elevation steps (same shadows as the website's --shadow-sm / --shadow / --shadow-lg): soft shadow on iOS, `elevation` on Android (needs the card's solid background). Spread into a style. */
export const elevation = {
  sm: { shadowColor: '#0B1320', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: '#0B1320', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  lg: { shadowColor: '#0B1320', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
} as const;
/** Older name for the card shadow. */
export const lift = elevation.md;
export type ElevationLevel = keyof typeof elevation;

/** Button sizes (same as the website): small 40, medium 48, large 56. */
export const buttonHeight = { sm: SHAPE['btn-sm'], md: SHAPE['btn-md'], lg: SHAPE['btn-lg'] } as const;
export const buttonRadius = SHAPE['radius-btn'];

export function useTheme() {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const appearance = usePrefs((s) => s.appearance);
  const scheme = appearance === 'system' ? system : appearance;
  const c = COLORS[scheme];
  // Light: a shadow lifts a surface. Dark: shadows vanish on navy, so a 1px border marks the edge instead.
  const elev = (level: ElevationLevel = 'md') =>
    scheme === 'dark' ? ({ borderWidth: 1, borderColor: c.line } as const) : elevation[level];
  return {
    scheme,
    elev,
    colors: {
      bg: c.bg,
      text: c.ink,
      // Main colour: satin gold in both modes (royal blue second in light, cobalt in dark). `primaryInk` is gold text that stays readable on the page.
      primary: c.brand,
      primaryInk: c['brand-ink'],
      primarySoft: c['brand-soft'],
      primaryHi: c['brand-hi'],
      primaryStrong: c['brand-strong'],
      onPrimary: c['on-brand'],
      accent: c.accent,
      accentInk: c['accent-ink'],
      onAccent: c['on-accent'],
      card: c.card,
      border: c.line,
      muted: c.muted,
      soft: c.soft,
      field: c.field,
      lineStrong: c['line-strong'],
      inverse: c.inverse,
      onInverse: c['on-inverse'],
      ok: c.ok,
      onOk: c['on-ok'],
      warn: c.warn,
      onWarn: c['on-warn'],
      warnSoft: c['warn-soft'],
      badSoft: c['bad-soft'],
      badInk: c['bad-ink'],
      danger: c.bad,
      onDanger: c['on-bad'],
    },
  };
}
export type Theme = ReturnType<typeof useTheme>;
