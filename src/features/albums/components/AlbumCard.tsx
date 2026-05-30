import { Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { type Album } from '@/lib/db'

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
            <Text style={styles.lockIcon}>🔒</Text>
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
    marginBottom: 16,
  },
  imageContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: CARD_SIZE,
    height: CARD_SIZE,
  },
  placeholder: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: '#D1D1D6',
  },
  lockBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  lockIcon: {
    fontSize: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginTop: 6,
  },
  count: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
})
