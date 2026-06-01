import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { useTheme } from '@/lib/themeContext'
import { radius, spacing, typography } from '@/lib/theme'

export function PermissionsEmptyState() {
  const { colors } = useTheme()

  return (
    <View style={styles.container}>
      <Svg width={120} height={120} viewBox="0 0 120 120">
        {/* Photo frame */}
        <Rect x="10" y="15" width="100" height="82" rx="8" stroke={colors.textSecondary} strokeWidth="2.5" fill="none" />
        {/* Lock shackle */}
        <Path
          d="M48 67 L48 56 Q48 44 60 44 Q72 44 72 56 L72 67"
          stroke={colors.textSecondary} strokeWidth="2" fill="none" strokeLinecap="round"
        />
        {/* Lock body */}
        <Rect x="40" y="66" width="40" height="30" rx="5" stroke={colors.textSecondary} strokeWidth="2" fill="none" />
        <Circle cx="60" cy="80" r="3.5" fill={colors.textSecondary} />
      </Svg>

      <Text style={[styles.title, { color: colors.text }]}>No access to photos</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Tap below to grant Gathr access to your photo library.
      </Text>

      <Pressable
        style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
        onPress={() => { void Linking.openSettings() }}
      >
        <Text style={styles.primaryBtnText}>Open Settings</Text>
      </Pressable>

      <Text style={[styles.hint, { color: colors.textTertiary }]}>
        Check app permissions in Settings → Gathr → Photos.
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
    marginBottom: spacing.sm,
  },
  primaryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: radius.xl,
    marginTop: spacing.sm,
  },
  primaryBtnText: {
    ...typography.title,
    color: '#FFFFFF',
  },
  hint: {
    ...typography.caption,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.xs,
  },
})
