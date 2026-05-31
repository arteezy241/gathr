import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelectionStore } from '@/store/selectionStore'
import { useGalleryStore } from '@/store/galleryStore'
import { hapticTap } from '@/lib/haptics'
import { useTheme } from '@/lib/themeContext'
import { GlassView } from '@/components/ui/GlassView'
import { typography } from '@/lib/theme'
import { PILL_HEIGHT, PILL_MARGIN_BOTTOM } from '@/components/ui/FloatingTabBar'

const PILL_H = 36
const SLIDE_DISTANCE = PILL_H + 12

export function SelectionBar() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const isSelecting = useSelectionStore((s) => s.isSelecting)
  const selectAll = useSelectionStore((s) => s.selectAll)
  const assets = useGalleryStore((s) => s.assets)

  const translateY = useRef(new Animated.Value(SLIDE_DISTANCE)).current

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isSelecting ? 0 : SLIDE_DISTANCE,
      useNativeDriver: true,
      speed: 26,
      bounciness: 6,
    }).start()
  }, [isSelecting, translateY])

  function handleSelectAll() {
    hapticTap()
    selectAll(assets.map((a) => a.id))
  }

  // Sits just above the FloatingTabBar pill
  const pillBottom = insets.bottom + PILL_MARGIN_BOTTOM + PILL_HEIGHT + 8

  return (
    <Animated.View
      style={[styles.pill, { bottom: pillBottom, transform: [{ translateY }] }]}
      pointerEvents={isSelecting ? 'auto' : 'none'}
    >
      <GlassView intensity={85} style={StyleSheet.absoluteFill} />
      <Pressable onPress={handleSelectAll} hitSlop={8}>
        <Text style={[styles.label, { color: colors.accent }]}>Select All</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    left: 16,
    height: PILL_H,
    borderRadius: PILL_H / 2,
    overflow: 'hidden',
    paddingHorizontal: 16,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  label: {
    ...typography.bodyMedium,
  },
})
