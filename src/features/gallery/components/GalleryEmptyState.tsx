import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { useRouter } from 'expo-router'
import { useTheme } from '@/lib/themeContext'
import { radius, spacing, typography } from '@/lib/theme'

export function GalleryEmptyState() {
  const { colors } = useTheme()
  const router = useRouter()
  const stroke = colors.textSecondary

  return (
    <View style={styles.container}>
      <Svg width={120} height={120} viewBox="0 0 120 120">
        {/* Camera body */}
        <Rect transform="translate(8, 36)" width="104" height="66" rx="10" stroke={stroke} strokeWidth="2.5" fill="none" />
        {/* Viewfinder bump */}
        <Path
          d="M40 36 L48 22 L72 22 L80 36"
          stroke={stroke} strokeWidth="2.5" fill="none" strokeLinejoin="round"
        />
        {/* Lens */}
        <Circle cx="60" cy="69" r="22" stroke={stroke} strokeWidth="2.5" fill="none" />
      </Svg>

      <Text style={[styles.title, { color: colors.text }]}>No photos yet</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Photos you take will appear here.
      </Text>

      <Pressable
        style={[styles.btn, { backgroundColor: colors.accent }]}
        onPress={() => { router.push('/camera') }}
      >
        <Text style={styles.btnText}>Open Camera</Text>
      </Pressable>
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
    minHeight: 360,
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
  btn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: radius.xl,
    marginTop: spacing.sm,
  },
  btnText: {
    ...typography.title,
    color: '#FFFFFF',
  },
})
