import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useTheme } from '@/lib/themeContext'
import { radius, spacing, typography } from '@/lib/theme'

interface Props {
  onCreateAlbum: () => void
}

export function AlbumsEmptyState({ onCreateAlbum }: Props) {
  const { colors } = useTheme()
  const stroke = colors.textSecondary

  return (
    <View style={styles.container}>
      <Svg width={120} height={120} viewBox="0 0 120 120">
        {/* Folder outline with tab */}
        <Path
          d="M12 52 L12 40 Q12 30 22 30 L50 30 L60 42 L98 42 Q108 42 108 52 L108 96 Q108 106 98 106 L22 106 Q12 106 12 96 L12 52 Z"
          stroke={stroke} strokeWidth="2.5" fill="none" strokeLinejoin="round"
        />
        {/* Horizontal lines inside suggesting photo stacks */}
        <Path
          d="M32 68 L88 68 M32 80 L75 80"
          stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round"
        />
      </Svg>

      <Text style={[styles.title, { color: colors.text }]}>No albums yet</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Create an album to organize your favorite photos, or import one from your device.
      </Text>

      <Pressable
        style={[styles.btn, { backgroundColor: colors.accent }]}
        onPress={onCreateAlbum}
      >
        <Text style={styles.btnText}>Create Album</Text>
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
