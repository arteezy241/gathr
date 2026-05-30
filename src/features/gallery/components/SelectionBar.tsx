import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '@/lib/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelectionStore } from '@/store/selectionStore'
import { useGalleryStore } from '@/store/galleryStore'
import { useAlbumStore } from '@/store/albumStore'
import { impactLight, impactMedium } from '@/lib/haptics'
import { shareMultipleAssets } from '@/lib/sharing'

const BAR_HEIGHT = 56

export function SelectionBar() {
  const insets = useSafeAreaInsets()
  const isSelecting = useSelectionStore((s) => s.isSelecting)
  const selectedIds = useSelectionStore((s) => s.selectedIds)
  const selectAll = useSelectionStore((s) => s.selectAll)
  const clearSelection = useSelectionStore((s) => s.clearSelection)
  const assets = useGalleryStore((s) => s.assets)
  const { albums, loadAlbums, addAssetsToAlbum } = useAlbumStore()

  const [isSharing, setIsSharing] = useState(false)

  const translateY = useRef(new Animated.Value(BAR_HEIGHT + insets.bottom)).current

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isSelecting ? 0 : BAR_HEIGHT + insets.bottom,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start()
  }, [isSelecting, insets.bottom, translateY])

  function handleSelectAll() {
    void impactLight()
    selectAll(assets.map((a) => a.id))
  }

  async function handleShare(): Promise<void> {
    if (isSharing) return
    void impactLight()
    const selected = assets.filter((a) => selectedIds.has(a.id))
    setIsSharing(true)
    try {
      await shareMultipleAssets(selected)
    } catch (e) {
      Alert.alert('Share Failed', e instanceof Error ? e.message : 'An error occurred while sharing.')
    } finally {
      setIsSharing(false)
    }
  }

  function handleAddToAlbum(): void {
    void impactLight()
    void loadAlbums()
    const publicAlbums = albums.filter((a) => !a.isPrivate)
    if (publicAlbums.length === 0) {
      Alert.alert('No Albums', 'Create an album first before adding photos.')
      return
    }
    const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' | 'default' }> = [
      ...publicAlbums.map((album) => ({
        text: album.name,
        onPress: () => {
          void (async () => {
            await addAssetsToAlbum(album.id, [...selectedIds])
            void impactMedium()
            clearSelection()
            Alert.alert('Added', `Added to ${album.name}`)
          })()
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]
    Alert.alert('Add to Album', 'Choose an album', buttons)
  }

  function handleDelete() {
    Alert.alert(
      'Delete Photos',
      `Delete ${String(selectedIds.size)} photo${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log('Delete:', [...selectedIds])
          },
        },
      ],
    )
  }

  const count = selectedIds.size
  const bottomPad = insets.bottom > 0 ? insets.bottom : 8

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingBottom: bottomPad, transform: [{ translateY }] },
      ]}
      pointerEvents={isSelecting ? 'auto' : 'none'}
    >
      <View style={styles.inner}>
        <Pressable onPress={handleSelectAll} style={styles.sideButton} hitSlop={8}>
          <Text style={styles.sideButtonText}>Select All</Text>
        </Pressable>

        <Text style={styles.countLabel}>
          {String(count)} {count === 1 ? 'selected' : 'selected'}
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={() => { void handleShare() }}
            style={[styles.iconButton, isSharing && styles.iconButtonDisabled]}
            hitSlop={8}
            disabled={isSharing}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color={theme.colors.accent} />
            ) : (
              <Ionicons name="share-outline" size={22} color={theme.colors.accent} />
            )}
          </Pressable>
          <Pressable onPress={handleAddToAlbum} style={styles.iconButton} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={22} color={theme.colors.accent} />
          </Pressable>
          <Pressable onPress={handleDelete} style={[styles.iconButton, styles.deleteButton]} hitSlop={8}>
            <Ionicons name="trash-outline" size={22} color={theme.colors.accentRed} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  inner: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  sideButton: {
    flex: 1,
    alignItems: 'flex-start',
  },
  sideButtonText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.accent,
  },
  countLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    textAlign: 'center',
  },
  actions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDisabled: {
    opacity: 0.45,
  },
  deleteButton: {},
})
