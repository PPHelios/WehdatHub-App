export const brand = {
  light: { copper: '#C45A30', azure: '#1D70B8', text: '#0E1521', background: '#FFFFFF' },
  dark: { copper: '#DC6A3D', azure: '#4E9FEA', text: '#F8FAFC', background: '#0E1521' },
} as const;

export type ThemeName = keyof typeof brand;
