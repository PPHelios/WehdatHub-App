export const brand = {
  light: { gold: '#C29741', royal: '#122B4F', text: '#0D182B', background: '#FFFFFF' },
  dark: { gold: '#D5AF55', cobalt: '#4B83D4', text: '#F8FAFC', background: '#09111F' },
} as const;

export type ThemeName = keyof typeof brand;
