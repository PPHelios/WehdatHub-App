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

/** Cool Depth Dark Green brand tokens. */
export const GREEN_PALETTE = {
  primary: '#0F3F34',
  primaryDark: '#082921',
  primaryLight: '#1A5647',
  primarySoft: '#EBF5F3',
  primarySoftDark: '#13352C',
  primaryLine: '#B7DED5',
  primaryLineDark: '#1D584C',
  primaryInk: '#082D25',
  primaryInkDark: '#6EE7B7',
  emerald: '#10B981',
  emeraldMint: '#34D399',
  amber: '#F59E0B',
  red: '#EF4444',
} as const;

export const greenGradient = {
  backgroundColor: GREEN_PALETTE.primary,
  experimental_backgroundImage: `linear-gradient(145deg, ${GREEN_PALETTE.primaryLight} 0%, ${GREEN_PALETTE.primary} 60%, ${GREEN_PALETTE.primaryDark} 100%)`,
} as const;

export const softGreenGradient = {
  light: { backgroundColor: '#0F3F340D', experimental_backgroundImage: 'linear-gradient(145deg, #34D39908 0%, #1A564710 100%)' },
  dark: { backgroundColor: '#34D39918', experimental_backgroundImage: 'linear-gradient(145deg, #34D3991C 0%, #34D3990D 100%)' },
} as const;

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
      // Main colour: Cool Depth Dark Green (#0F3F34) with deep ink and soft sage surfaces.
      primary: GREEN_PALETTE.primary,
      primaryInk: scheme === 'dark' ? GREEN_PALETTE.primaryInkDark : GREEN_PALETTE.primaryInk,
      primarySoft: scheme === 'dark' ? GREEN_PALETTE.primarySoftDark : GREEN_PALETTE.primarySoft,
      requiredField: scheme === 'dark' ? `${GREEN_PALETTE.emeraldMint}14` : `${GREEN_PALETTE.primary}0A`,
      primaryLine: scheme === 'dark' ? GREEN_PALETTE.primaryLineDark : GREEN_PALETTE.primaryLine,
      primaryHi: GREEN_PALETTE.primaryLight,
      primaryStrong: GREEN_PALETTE.primaryDark,
      onPrimary: '#FFFFFF',
      chartBar: scheme === 'dark' ? GREEN_PALETTE.emerald : GREEN_PALETTE.primary,
      spinner: scheme === 'dark' ? GREEN_PALETTE.primaryInkDark : GREEN_PALETTE.primary,
      accent: c.accent,
      accentInk: c['accent-ink'],
      onAccent: c['on-accent'],
      card: c.card,
      cardSubtle: c.soft,
      border: c.line,
      muted: c.muted,
      soft: c.soft,
      field: c.field,
      lineStrong: c['line-strong'],
      inverse: c.inverse,
      onInverse: c['on-inverse'],
      ok: scheme === 'dark' ? GREEN_PALETTE.emerald : '#0F766E',
      onOk: scheme === 'dark' ? '#06260F' : '#FFFFFF',
      okSoft: scheme === 'dark' ? GREEN_PALETTE.primarySoftDark : GREEN_PALETTE.primarySoft,
      okInk: scheme === 'dark' ? GREEN_PALETTE.primaryInkDark : GREEN_PALETTE.primaryInk,
      warn: scheme === 'dark' ? GREEN_PALETTE.amber : '#B45309',
      onWarn: c['on-warn'],
      warnInk: scheme === 'dark' ? '#FCD34D' : '#92400E',
      warnSoft: scheme === 'dark' ? '#2A1F0B' : '#FEF3C7',
      badSoft: c['bad-soft'],
      badInk: c['bad-ink'],
      danger: c.bad,
      onDanger: c['on-bad'],
    },
  };
}
export type Theme = ReturnType<typeof useTheme>;
