import { useRef } from 'react'
import { Animated, Platform, Pressable, StyleSheet, Text } from 'react-native'
import { Image } from 'expo-image'
import { GlassView } from '@/components/ui/GlassView'
import { type Memory } from '@/lib/memories'
import { radius, typography } from '@/lib/theme'

interface Props {
  memory: Memory
  onPress: () => void
}

const CARD_W = 220
const CARD_H = 150

function assetUri(id: string): string {
  return Platform.OS === 'ios' ? `ph://${id}` : id
}

export function MemoryCard({ memory, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 5 }).start()
  }

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
      <Image
        source={{ uri: assetUri(memory.coverAssetId) }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        recyclingKey={memory.coverAssetId}
        transition={200}
      />
      {/* Gradient overlay */}
      <GlassView intensity={45} tint="dark" style={styles.overlay}>
        <Text style={styles.label} numberOfLines={2}>{memory.label}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{memory.subtitle}</Text>
      </GlassView>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  label: {
    ...typography.bodyMedium,
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
})
