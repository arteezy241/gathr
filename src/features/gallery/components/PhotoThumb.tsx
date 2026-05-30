import { Image } from 'expo-image'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'
import { impactLight } from '@/lib/haptics'
import { useSelectionStore } from '@/store/selectionStore'

const THUMB_SIZE = 120
const CIRCLE_SIZE = 22
const BORDER_RADIUS = CIRCLE_SIZE / 2

interface Props {
  asset: MediaLibraryAsset
  isSelected: boolean
  allAssetIds: string[]
  onPress: () => void
  onLongPress: () => void
}

function assetUri(asset: MediaLibraryAsset): string {
  return Platform.OS === 'ios' ? `ph://${asset.id}` : asset.id
}

export function PhotoThumb({ asset, isSelected, allAssetIds, onPress, onLongPress }: Props) {
  const isSelecting = useSelectionStore((s) => s.isSelecting)
  const lastSelectedId = useSelectionStore((s) => s.lastSelectedId)
  const toggleSelect = useSelectionStore((s) => s.toggleSelect)
  const selectRange = useSelectionStore((s) => s.selectRange)
  const setLastSelected = useSelectionStore((s) => s.setLastSelected)

  function handlePress() {
    if (isSelecting) {
      void impactLight()
      if (lastSelectedId !== null) {
        selectRange(allAssetIds, lastSelectedId, asset.id)
      } else {
        toggleSelect(asset.id)
      }
      setLastSelected(asset.id)
    } else {
      onPress()
    }
  }

  function handleLongPress() {
    void impactLight()
    toggleSelect(asset.id)
    setLastSelected(asset.id)
    onLongPress()
  }

  const showCircle = isSelected || isSelecting

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={styles.container}
      accessibilityRole="imagebutton"
      accessibilityState={{ selected: isSelected }}
    >
      <Image
        source={{ uri: assetUri(asset) }}
        style={styles.image}
        contentFit="cover"
        recyclingKey={asset.id}
      />

      {isSelected && <View style={styles.selectedOverlay} />}

      {showCircle && (
        <View style={[styles.circle, isSelected ? styles.circleSelected : styles.circleEmpty]}>
          {isSelected && <View style={styles.checkmark} />}
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  image: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 122, 255, 0.25)',
  },
  circle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelected: {
    backgroundColor: '#007AFF',
  },
  circleEmpty: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    backgroundColor: 'rgba(0, 0, 0, 0.20)',
  },
  // Simple SVG-free checkmark: a rotated L-shape using absolute borders
  checkmark: {
    width: 10,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#ffffff',
    transform: [{ rotate: '-45deg' }, { translateY: -1 }],
  },
})
