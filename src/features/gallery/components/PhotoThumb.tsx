import { useRef } from 'react'
import { Animated, Dimensions, Platform, Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'
import { impactLight } from '@/lib/haptics'
import { useSelectionStore } from '@/store/selectionStore'
import { theme } from '@/lib/theme'

// 3 columns, 2 gaps of 2px between them — no gap on edges
const GAP = 2
export const THUMB_SIZE = Math.floor((Dimensions.get('window').width - GAP * 2) / 3)
const CIRCLE_SIZE = 24

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

  const scale = useRef(new Animated.Value(1)).current

  function handlePressIn() {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start()
  }

  function handlePressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start()
  }

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
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="imagebutton"
      accessibilityState={{ selected: isSelected }}
    >
      <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
        <Image
          source={{ uri: assetUri(asset) }}
          style={styles.image}
          contentFit="cover"
          recyclingKey={asset.id}
        />

        {isSelected && <View style={styles.selectedOverlay} />}

        {showCircle && (
          <View style={styles.circleContainer}>
            <Ionicons
              name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
              size={CIRCLE_SIZE}
              color={isSelected ? theme.colors.accent : 'rgba(255,255,255,0.65)'}
            />
          </View>
        )}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    overflow: 'hidden',
  },
  image: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.selectedOverlay,
  },
  circleContainer: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
})
