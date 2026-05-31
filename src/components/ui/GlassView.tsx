import { type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { BlurView } from 'expo-blur'
import { useTheme } from '@/lib/themeContext'

interface Props {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  intensity?: number
  /** Override theme-based tint. Use 'dark' for overlays on photos/images. */
  tint?: 'dark' | 'light' | 'extraLight'
}

export function GlassView({ children, style, intensity = 55, tint }: Props) {
  const { isDark, colors } = useTheme()
  const resolvedTint = tint ?? (isDark ? 'dark' : 'extraLight')

  return (
    <BlurView
      intensity={intensity}
      tint={resolvedTint}
      style={[styles.blur, style]}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.glass, borderColor: colors.glassBorder, borderWidth: StyleSheet.hairlineWidth },
        ]}
      />
      {children}
    </BlurView>
  )
}

const styles = StyleSheet.create({
  blur: {
    overflow: 'hidden',
  },
})
