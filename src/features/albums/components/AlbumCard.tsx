import { useRef } from 'react'
import { Animated, Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { type Album } from '@/lib/db'

export const GRID_GAP = 2
export const CARD_SIZE = Math.floor((Dimensions.get('window').width - GRID_GAP) / 2)

interface Props {
  album: Album
  assetCount: number
  onPress: () => void
  onLongPress?: () => void
}

function coverUri(assetId: string): string {
  return Platform.OS === 'ios' ? `ph://${assetId}` : assetId
}

export function AlbumCard({ album, assetCount, onPress, onLongPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 5 }).start()
  }

  const countStr = assetCount === 0 ? '' : assetCount.toLocaleString()

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      delayLongPress={500}
      style={styles.outer}
    >
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        {album.coverAssetId !== null ? (
          <Image
            source={{ uri: coverUri(album.coverAssetId) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            recyclingKey={album.coverAssetId}
            transition={200}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.70)']}
          style={styles.scrim}
          pointerEvents="none"
        />

        <View style={styles.labelRow}>
          <Text style={styles.name} numberOfLines={1}>{album.name}</Text>
          {countStr ? <Text style={styles.count}>{countStr}</Text> : null}
        </View>

        {album.isPrivate && (
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={10} color="rgba(255,255,255,0.72)" />
          </View>
        )}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  outer: {
    width: CARD_SIZE,
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#1a1428',
  },
  placeholder: {
    backgroundColor: '#1a1428',
  },
  scrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '52%',
  },
  labelRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 9,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
  },
  name: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.05,
  },
  count: {
    color: 'rgba(235,235,245,0.50)',
    fontSize: 10.5,
    fontWeight: '500',
    flexShrink: 0,
    paddingBottom: 1,
  },
  lockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
