import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { type MediaLibraryAsset, MediaType } from '@/lib/mediaLibrary'
import { hapticSelect, hapticToggle, hapticTap } from '@/lib/haptics'
import { useSelectionStore } from '@/store/selectionStore'
import { useTheme } from '@/lib/themeContext'

const GAP = 2
export const THUMB_SIZE = Math.floor((Dimensions.get('window').width - GAP * 2) / 3)
const CIRCLE_SIZE = 24
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const PREVIEW_W = SCREEN_W * 0.82
const PREVIEW_H = SCREEN_H * 0.58

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

interface PreviewProps {
  asset: MediaLibraryAsset
  uri: string
  isVideo: boolean
  onClose: () => void
  onOpen: () => void
  onSelect: () => void
}

function PhotoPeekModal({ asset, uri, isVideo, onClose, onOpen, onSelect }: PreviewProps) {
  const { colors } = useTheme()
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const cardScale = useRef(new Animated.Value(0.88)).current
  const cardOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, speed: 32, bounciness: 8 }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start()
  }, [])

  function dismiss(cb: () => void) {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 0.92, duration: 130, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 130, useNativeDriver: true }),
    ]).start(() => { cb() })
  }

  return (
    <Modal transparent animationType="none" statusBarTranslucent>
      <View style={styles.peekRoot}>
        {/* Backdrop tap-to-dismiss */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { dismiss(onClose) }} />
        </Animated.View>

        {/* Floating card — centered by peekRoot flex */}
        <Animated.View
          style={[
            styles.peekCard,
            { backgroundColor: colors.surface, transform: [{ scale: cardScale }], opacity: cardOpacity },
          ]}
        >
          <Image
            source={{ uri }}
            style={styles.peekImage}
            contentFit="contain"
            recyclingKey={asset.id}
            transition={180}
          />

          <View style={[styles.peekActions, { borderTopColor: colors.border }]}>
            <Pressable style={styles.peekAction} onPress={() => { hapticTap(); dismiss(onOpen) }}>
              <Ionicons name={isVideo ? 'play-circle-outline' : 'expand-outline'} size={22} color={colors.accent} />
              <Text style={[styles.peekActionLabel, { color: colors.accent }]}>{isVideo ? 'Play' : 'Open'}</Text>
            </Pressable>

            <View style={[styles.peekDivider, { backgroundColor: colors.border }]} />

            <Pressable style={styles.peekAction} onPress={() => {
              hapticToggle()
              dismiss(onSelect)
            }}>
              <Ionicons name="checkmark-circle-outline" size={22} color={colors.text} />
              <Text style={[styles.peekActionLabel, { color: colors.text }]}>Select</Text>
            </Pressable>

            <View style={[styles.peekDivider, { backgroundColor: colors.border }]} />

            <Pressable style={styles.peekAction} onPress={() => { hapticTap(); dismiss(onClose) }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
              <Text style={[styles.peekActionLabel, { color: colors.textSecondary }]}>Close</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

export const PhotoThumb = memo(function PhotoThumb({ asset, isSelected, onPress }: Props) {
  const { colors } = useTheme()
  const isSelecting = useSelectionStore((s) => s.isSelecting)
  const toggleSelect = useSelectionStore((s) => s.toggleSelect)
  const setLastSelected = useSelectionStore((s) => s.setLastSelected)

  const [peekVisible, setPeekVisible] = useState(false)
  const [isVideo, setIsVideo] = useState(false)
  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    let cancelled = false
    void asset.getMediaType().then((type) => {
      if (!cancelled) setIsVideo(type === MediaType.VIDEO)
    })
    return () => { cancelled = true }
  }, [asset])

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
  }, [scale])

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
  }, [scale])

  const handlePress = useCallback(() => {
    if (isSelecting) {
      hapticToggle()
      toggleSelect(asset.id)
      setLastSelected(asset.id)
    } else {
      onPress()
    }
  }, [isSelecting, toggleSelect, setLastSelected, asset.id, onPress])

  const handleLongPress = useCallback(() => {
    hapticSelect()
    setPeekVisible(true)
  }, [])

  const showCircle = isSelected || isSelecting

  return (
    <>
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={400}
        accessibilityRole="imagebutton"
        accessibilityState={{ selected: isSelected }}
      >
        <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
          <Image
            source={{ uri: assetUri(asset) }}
            style={styles.image}
            contentFit="cover"
            recyclingKey={asset.id}
            transition={120}
          />

          {isSelected && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.selectedOverlay }]} />
          )}

          {isVideo && !showCircle && (
            <View style={styles.playIconContainer}>
              <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.9)" />
            </View>
          )}

          {showCircle && (
            <View style={styles.circleContainer}>
              <Ionicons
                name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                size={CIRCLE_SIZE}
                color={isSelected ? colors.accent : 'rgba(255,255,255,0.65)'}
              />
            </View>
          )}
        </Animated.View>
      </Pressable>

      {peekVisible && (
        <PhotoPeekModal
          asset={asset}
          uri={assetUri(asset)}
          isVideo={isVideo}
          onClose={() => { setPeekVisible(false) }}
          onOpen={() => { setPeekVisible(false); onPress() }}
          onSelect={() => {
            setPeekVisible(false)
            toggleSelect(asset.id)
            setLastSelected(asset.id)
          }}
        />
      )}
    </>
  )
})

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
  circleContainer: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  playIconContainer: {
    position: 'absolute',
    bottom: 5,
    left: 5,
  },
  // Peek modal
  peekRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  peekCard: {
    width: PREVIEW_W,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 20,
  },
  peekImage: {
    width: PREVIEW_W,
    height: PREVIEW_H,
  },
  peekActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  peekAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 4,
  },
  peekActionLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  peekDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
})
