import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { darkColors, lightColors, radius, spacing, typography, type ThemeColors } from './theme'

const THEME_KEY = 'gathr_theme_override'

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

  // Restore persisted preference on mount
  useEffect(() => {
    void SecureStore.getItemAsync(THEME_KEY).then((stored) => {
      if (stored === 'dark' || stored === 'light') setOverride(stored)
    })
  }, [])

  const isDark = (override ?? system) !== 'light'
  const colors = isDark ? darkColors : lightColors

  const toggle = useCallback(() => {
    setOverride((prev) => {
      const current = prev ?? (system === 'light' ? 'light' : 'dark')
      const next = current === 'dark' ? 'light' : 'dark'
      void SecureStore.setItemAsync(THEME_KEY, next)
      return next
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
