export const darkColors = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  border: '#3A3A3C',
  text: '#FFFFFF',
  textSecondary: 'rgba(235,235,245,0.8)',
  textTertiary: 'rgba(235,235,245,0.6)',
  accent: '#0A84FF',
  accentGreen: '#30D158',
  accentRed: '#FF453A',
  selectedOverlay: 'rgba(10,132,255,0.3)',
  glass: 'rgba(28,28,30,0.75)',
  glassBorder: 'rgba(255,255,255,0.1)',
} as const

export const lightColors = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceElevated: '#E5E5EA',
  border: 'rgba(60,60,67,0.18)',
  text: '#000000',
  textSecondary: 'rgba(60,60,67,0.6)',
  textTertiary: 'rgba(60,60,67,0.3)',
  accent: '#007AFF',
  accentGreen: '#34C759',
  accentRed: '#FF3B30',
  selectedOverlay: 'rgba(0,122,255,0.25)',
  glass: 'rgba(255,255,255,0.72)',
  glassBorder: 'rgba(255,255,255,0.45)',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const

export const typography = {
  caption: { fontSize: 12, fontWeight: '400' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, fontWeight: '500' as const },
  title: { fontSize: 17, fontWeight: '600' as const },
  headline: { fontSize: 22, fontWeight: '700' as const },
} as const

// Backward-compat static export — use useTheme() for dynamic theming
export const theme = {
  colors: darkColors,
  spacing,
  radius,
  typography,
} as const

export type ThemeColors = {
  background: string
  surface: string
  surfaceElevated: string
  border: string
  text: string
  textSecondary: string
  textTertiary: string
  accent: string
  accentGreen: string
  accentRed: string
  selectedOverlay: string
  glass: string
  glassBorder: string
}
export type Theme = typeof theme
