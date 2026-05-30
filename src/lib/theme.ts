const colors = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  border: '#3A3A3C',
  text: '#FFFFFF',
  textSecondary: '#EBEBF5CC',
  textTertiary: '#EBEBF599',
  accent: '#0A84FF',
  accentGreen: '#30D158',
  accentRed: '#FF453A',
  selectedOverlay: 'rgba(10, 132, 255, 0.3)',
} as const

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const

const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const

const typography = {
  caption: { fontSize: 12, fontWeight: '400' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, fontWeight: '500' as const },
  title: { fontSize: 17, fontWeight: '600' as const },
  headline: { fontSize: 22, fontWeight: '700' as const },
} as const

export const theme = {
  colors,
  spacing,
  radius,
  typography,
} as const

export type Theme = typeof theme
export type ThemeColors = typeof colors
