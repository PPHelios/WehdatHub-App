import { useColorScheme } from 'react-native';
import { brand } from '@wehdathub/shared';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;

export function useTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = brand[scheme];
  const dark = scheme === 'dark';
  return {
    scheme,
    colors: {
      bg: c.background,
      text: c.text,
      primary: c.azure,
      accent: c.copper,
      onPrimary: '#FFFFFF',
      card: dark ? '#162033' : '#F3F5F8',
      border: dark ? '#263246' : '#E3E7EE',
      muted: dark ? '#9AA7BA' : '#5B6575',
      danger: dark ? '#F97066' : '#B42318',
    },
  };
}
export type Theme = ReturnType<typeof useTheme>;
