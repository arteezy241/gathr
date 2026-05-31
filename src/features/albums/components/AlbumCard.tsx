import { useMemo, useRef } from 'react'
import { Animated, Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { type Album } from '@/lib/db'
import { useTheme } from '@/lib/themeContext'
import { GlassView } from '@/components/ui/GlassView'
import { radius, spacing, typography, type ThemeColors } from '@/lib/theme'

interface Props {
  album: Album
  assetCount: number
  onPress: () => void
}

const GAP = 10
const COLUMNS = 2
const HORIZONTAL_PAD = 16
const CARD_SIZE = Math.floor((Dimensions.get('window').width - HORIZONTAL_PAD * 2 - GAP * (COLUMNS - 1)) / COLUMNS)

function coverUri(assetId: string): string {
  return Platform.OS === 'ios' ? `ph://${assetId}` : assetId
}

export function AlbumCard({ album, assetCount, onPress }: Props) {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const scale = useRef(new Animated.Value(1)).current

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 5 }).start()
  }

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.container}>
      <Animated.View style={{ transform: [{ scale }] }}>
      <View style={styles.imageContainer}>
        {album.coverAssetId !== null ? (
          <Image
            source={{ uri: coverUri(album.coverAssetId) }}
            style={styles.image}
            contentFit="cover"
            recyclingKey={album.coverAssetId}
            transition={200}
          />
        ) : (
          <View style={styles.placeholder} />
        )}
        {album.isPrivate && (
          <GlassView intensity={60} tint="dark" style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={12} color="#ffffff" />
          </GlassView>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>{album.name}</Text>
      <Text style={styles.count}>{String(assetCount)} {assetCount === 1 ? 'photo' : 'photos'}</Text>
      </Animated.View>
    </Pressable>
  )
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      width: CARD_SIZE,
      marginBottom: spacing.sm,
    },
    imageContainer: {
      width: CARD_SIZE,
      height: CARD_SIZE,
      borderRadius: radius.xl,
      overflow: 'hidden',
    },
    image: {
      width: CARD_SIZE,
      height: CARD_SIZE,
    },
    placeholder: {
      width: CARD_SIZE,
      height: CARD_SIZE,
      backgroundColor: colors.surfaceElevated,
    },
    lockBadge: {
      position: 'absolute',
      top: 6,
      left: 6,
      borderRadius: 6,
      paddingHorizontal: 5,
      paddingVertical: 3,
      overflow: 'hidden',
    },
    name: {
      ...typography.bodyMedium,
      color: colors.text,
      marginTop: spacing.xs + 2,
    },
    count: {
      ...typography.caption,
      color: colors.textTertiary,
      marginTop: 2,
    },
  })
}
