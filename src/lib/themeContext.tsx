import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { darkColors, lightColors, radius, spacing, typography, type ThemeColors } from './theme'

interface ThemeContextValue {
  colors: ThemeColors
  isDark: boolean
  toggle: () => void
  spacing: typeof spacing
  radius: typeof radius
  typography: typeof typography
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme()
  const [override, setOverride] = useState<'dark' | 'light' | null>(null)

  const isDark = (override ?? system ?? 'dark') !== 'light'
  const colors = isDark ? darkColors : lightColors

  const toggle = useCallback(() => {
    setOverride((prev) => {
      const current = prev ?? (system === 'light' ? 'light' : 'dark')
      return current === 'dark' ? 'light' : 'dark'
    })
  }, [system])

  const value = useMemo<ThemeContextValue>(
    () => ({ colors, isDark, toggle, spacing, radius, typography }),
    [colors, isDark, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (ctx === null) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
