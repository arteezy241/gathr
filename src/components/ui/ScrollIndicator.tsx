import { useEffect, useRef, useState } from 'react'
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native'
import { useTheme } from '@/lib/themeContext'

interface Props {
  scrollY: Animated.Value
  contentHeight: number
  viewHeight: number
  onSeek: (offset: number) => void
}

const TRACK_V_PAD = 20
const THUMB_H = 56
const WIDTH_COLLAPSED = 5
const WIDTH_EXPANDED = 26
const COLLAPSE_DELAY = 2200

export function ScrollIndicator({ scrollY, contentHeight, viewHeight, onSeek }: Props) {
  const { colors } = useTheme()
  const [expanded, setExpanded] = useState(false)
  const expandedRef = useRef(false)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // JS-driven animations (layout props — cannot use native driver)
  const widthAnim = useRef(new Animated.Value(WIDTH_COLLAPSED)).current
  const opacityAnim = useRef(new Animated.Value(0.4)).current

  const trackH = Math.max(1, viewHeight - TRACK_V_PAD * 2)
  const scrollable = Math.max(1, contentHeight - viewHeight)
  const maxTranslate = trackH - THUMB_H

  // Native-driver interpolation — runs entirely on UI thread, zero JS during scroll
  const thumbTranslate = scrollY.interpolate({
    inputRange: [0, scrollable],
    outputRange: [TRACK_V_PAD, TRACK_V_PAD + Math.max(0, maxTranslate)],
    extrapolate: 'clamp',
  })

  function expand() {
    if (collapseTimer.current !== null) clearTimeout(collapseTimer.current)
    expandedRef.current = true
    setExpanded(true)
    Animated.parallel([
      Animated.spring(widthAnim, { toValue: WIDTH_EXPANDED, useNativeDriver: false, speed: 24, bounciness: 0 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
    ]).start()
    scheduleCollapse()
  }

  function collapse() {
    expandedRef.current = false
    setExpanded(false)
    Animated.parallel([
      Animated.spring(widthAnim, { toValue: WIDTH_COLLAPSED, useNativeDriver: false, speed: 24, bounciness: 0 }),
      Animated.timing(opacityAnim, { toValue: 0.4, duration: 200, useNativeDriver: false }),
    ]).start()
  }

  function scheduleCollapse() {
    if (collapseTimer.current !== null) clearTimeout(collapseTimer.current)
    collapseTimer.current = setTimeout(collapse, COLLAPSE_DELAY)
  }

  useEffect(() => () => {
    if (collapseTimer.current !== null) clearTimeout(collapseTimer.current)
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

  const rafRef = useRef<number | null>(null)

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => expandedRef.current,
      onMoveShouldSetPanResponder: () => expandedRef.current,
      onPanResponderGrant: () => {
        if (collapseTimer.current !== null) clearTimeout(collapseTimer.current)
      },
      onPanResponderMove: (_, gs) => {
        if (rafRef.current !== null) return   // skip if previous frame not done
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          const pct = Math.max(0, Math.min(1, (gs.moveY - TRACK_V_PAD) / trackH))
          onSeek(pct * scrollable)
        })
      },
      onPanResponderRelease: () => { scheduleCollapse() },
    }),
  ).current

  if (viewHeight === 0) return null

  return (
    <View style={[styles.wrapper, { height: viewHeight }]} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.track,
          {
            height: viewHeight,
            width: widthAnim,
            opacity: opacityAnim,
            backgroundColor: expanded ? 'rgba(128,128,128,0.15)' : 'transparent',
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={expand} />

        {/* transform: translateY avoids layout recalculation on every frame */}
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: colors.accent,
              transform: [{ translateY: thumbTranslate }],
            },
          ]}
          pointerEvents="none"
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 2,
    top: 0,
    width: WIDTH_EXPANDED + 8,
    alignItems: 'flex-end',
  },
  track: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    top: 0,
    left: 2,
    right: 2,
    height: THUMB_H,
    borderRadius: 10,
  },
})
