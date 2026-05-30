import { useEffect, useRef } from 'react'
import { Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelectionStore } from '@/store/selectionStore'
import { useGalleryStore } from '@/store/galleryStore'
import { impactLight } from '@/lib/haptics'

const BAR_HEIGHT = 56

export function SelectionBar() {
  const insets = useSafeAreaInsets()
  const isSelecting = useSelectionStore((s) => s.isSelecting)
  const selectedIds = useSelectionStore((s) => s.selectedIds)
  const selectAll = useSelectionStore((s) => s.selectAll)
  const assets = useGalleryStore((s) => s.assets)

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

  function handleShare() {
    void impactLight()
    console.log('Share:', [...selectedIds])
  }

  function handleAddToAlbum() {
    void impactLight()
    console.log('Add to album:', [...selectedIds])
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
          <Pressable onPress={handleShare} style={styles.iconButton} hitSlop={8}>
            <Text style={styles.iconLabel}>↑</Text>
          </Pressable>
          <Pressable onPress={handleAddToAlbum} style={styles.iconButton} hitSlop={8}>
            <Text style={styles.iconLabel}>＋</Text>
          </Pressable>
          <Pressable onPress={handleDelete} style={[styles.iconButton, styles.deleteButton]} hitSlop={8}>
            <Text style={[styles.iconLabel, styles.deleteLabel]}>🗑</Text>
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
    backgroundColor: '#f2f2f7',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.2)',
  },
  inner: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  sideButton: {
    flex: 1,
    alignItems: 'flex-start',
  },
  sideButtonText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500',
  },
  countLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  actions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {},
  iconLabel: {
    fontSize: 18,
    color: '#007AFF',
  },
  deleteLabel: {
    color: '#FF3B30',
  },
})
