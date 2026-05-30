import { Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { type Album } from '@/lib/db'
import { theme } from '@/lib/theme'

interface Props {
  album: Album
  assetCount: number
  onPress: () => void
}

const CARD_SIZE = Math.floor((Dimensions.get('window').width - 3) / 2)

function coverUri(assetId: string): string {
  return Platform.OS === 'ios' ? `ph://${assetId}` : assetId
}

export function AlbumCard({ album, assetCount, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={styles.imageContainer}>
        {album.coverAssetId !== null ? (
          <Image
            source={{ uri: coverUri(album.coverAssetId) }}
            style={styles.image}
            contentFit="cover"
            recyclingKey={album.coverAssetId}
          />
        ) : (
          <View style={styles.placeholder} />
        )}
        {album.isPrivate && (
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={12} color="#ffffff" />
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>{album.name}</Text>
      <Text style={styles.count}>{String(assetCount)} {assetCount === 1 ? 'photo' : 'photos'}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    width: CARD_SIZE,
    marginBottom: theme.spacing.md,
  },
  imageContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
  },
  image: {
    width: CARD_SIZE,
    height: CARD_SIZE,
  },
  placeholder: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: theme.colors.surfaceElevated,
  },
  lockBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  name: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    marginTop: theme.spacing.xs + 2,
  },
  count: {
    ...theme.typography.caption,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
})
