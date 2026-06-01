import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { useTheme } from '@/lib/themeContext'
import { spacing, typography } from '@/lib/theme'

export function TripsEmptyState() {
  const { colors } = useTheme()
  const stroke = colors.textSecondary

  return (
    <View style={styles.container}>
      <Svg width={120} height={120} viewBox="0 0 120 120">
        {/* Mountain silhouette */}
        <Path
          d="M5 106 L42 44 L60 68 L80 35 L115 106"
          stroke={stroke} strokeWidth="2.5" fill="none"
          strokeLinejoin="round" strokeLinecap="round"
        />
        {/* Sun */}
        <Circle cx="98" cy="24" r="11" stroke={stroke} strokeWidth="2" fill="none" />
      </Svg>

      <Text style={[styles.title, { color: colors.text }]}>No trips detected yet</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Gathr looks for groups of photos taken over multiple days. Take your phone on your next adventure.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.headline,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  body: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 22,
  },
})
