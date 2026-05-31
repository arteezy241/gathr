import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { GlassView } from '@/components/ui/GlassView'
import { useTheme } from '@/lib/themeContext'
import { useSelectionStore } from '@/store/selectionStore'
import { hapticSwitch, hapticTap } from '@/lib/haptics'
import { typography } from '@/lib/theme'
import { useSelectionActions } from '@/hooks/useSelectionActions'

interface TabRoute {
  key: string
  name: string
}

interface TabBarProps {
  state: { routes: TabRoute[]; index: number }
  descriptors: Record<string, { options: { title?: string } }>
  navigation: { navigate: (name: string) => void }
}

export const PILL_HEIGHT = 56
export const PILL_MARGIN_BOTTOM = 10

export function FloatingTabBar({ state, navigation }: TabBarProps) {
  const { colors, isDark, toggle } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { isSelecting, selectedIds, clearSelection } = useSelectionStore()
  const selectedCount = selectedIds.size
  const { isSharing, exportProgress, handleShare, handleExport, handleAddToAlbum, handleDelete } = useSelectionActions()

  const ICONS: Record<string, { active: string; inactive: string }> = {
    index: { active: 'images-sharp', inactive: 'images' },
    trips: { active: 'map', inactive: 'map-outline' },
    albums: { active: 'albums-sharp', inactive: 'albums' },
  }

  return (
    <View
      style={[
        styles.wrapper,
        { bottom: insets.bottom + PILL_MARGIN_BOTTOM },
      ]}
      pointerEvents="box-none"
    >
      <GlassView intensity={90} style={styles.pill}>
        {isSelecting ? (
          <>
            {/* Count */}
            <Text style={[styles.selectionCount, { color: colors.text }]} numberOfLines={1}>
              {String(selectedCount)} selected
            </Text>

            {/* Action icons */}
            <View style={styles.selectionActions}>
              <Pressable
                onPress={() => { void handleShare() }}
                style={styles.actionBtn}
                hitSlop={10}
                disabled={isSharing || exportProgress !== null}
              >
                {isSharing
                  ? <ActivityIndicator size="small" color={colors.accent} />
                  : <Ionicons name="share-outline" size={22} color={colors.accent} />}
              </Pressable>

              <Pressable
                onPress={() => { void handleExport() }}
                style={styles.actionBtn}
                hitSlop={10}
                disabled={exportProgress !== null || isSharing}
              >
                {exportProgress !== null
                  ? <ActivityIndicator size="small" color={colors.accent} />
                  : <Ionicons name="archive-outline" size={22} color={colors.accent} />}
              </Pressable>

              <Pressable onPress={handleAddToAlbum} style={styles.actionBtn} hitSlop={10}>
                <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
              </Pressable>

              <Pressable onPress={handleDelete} style={styles.actionBtn} hitSlop={10}>
                <Ionicons name="trash-outline" size={22} color={colors.accentRed} />
              </Pressable>
            </View>

            {/* Cancel */}
            <Pressable onPress={clearSelection} hitSlop={12}>
              <Text style={[styles.cancelLabel, { color: colors.accent }]}>Cancel</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Gathr</Text>

            <View style={[styles.segment, { backgroundColor: colors.surface }]}>
              {state.routes.map((route, index) => {
                const focused = state.index === index
                const icons = ICONS[route.name]
                const iconName = icons
                  ? (focused ? icons.active : icons.inactive)
                  : 'images'

                return (
                  <Pressable
                    key={route.key}
                    onPress={() => { hapticSwitch(); navigation.navigate(route.name) }}
                    style={[
                      styles.segmentTab,
                      focused && { backgroundColor: colors.accent },
                    ]}
                    hitSlop={4}
                  >
                    <Ionicons
                      name={iconName as 'images'}
                      size={18}
                      color={focused ? '#FFFFFF' : colors.textTertiary}
                    />
                  </Pressable>
                )
              })}
            </View>

            <View style={styles.rightActions}>
              <Pressable onPress={() => { hapticTap(); router.push('/camera') }} hitSlop={10}>
                <Ionicons name="camera-outline" size={20} color={colors.accent} />
              </Pressable>
              <Pressable onPress={() => { hapticSwitch(); toggle() }} hitSlop={10}>
                <Ionicons
                  name={isDark ? 'sunny-outline' : 'moon-outline'}
                  size={20}
                  color={colors.accent}
                />
              </Pressable>
            </View>
          </>
        )}
      </GlassView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    height: PILL_HEIGHT,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: PILL_HEIGHT / 2,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  title: {
    ...typography.headline,
    fontSize: 17,
  },
  selectionCount: {
    ...typography.bodyMedium,
    fontSize: 14,
    flexShrink: 1,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginHorizontal: 4,
  },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    ...typography.bodyMedium,
    fontSize: 15,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 3,
    gap: 2,
  },
  segmentTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 17,
  },
})
