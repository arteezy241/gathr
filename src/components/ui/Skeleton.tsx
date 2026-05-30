import { useEffect, useRef } from 'react'
import { Animated, type DimensionValue, StyleSheet, View } from 'react-native'
import { theme } from '@/lib/theme'

interface Props {
  width: DimensionValue
  height: number
  borderRadius?: number
}

export function Skeleton({ width, height, borderRadius = 0 }: Props) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    )
    pulse.start()
    return () => { pulse.stop() }
  }, [opacity])

  return (
    <View style={{ width, height, borderRadius, overflow: 'hidden' }}>
      <Animated.View style={[styles.fill, { opacity }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.surfaceElevated,
  },
})
