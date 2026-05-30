import { Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { type StoredTrip } from '@/lib/db'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'

interface Props {
  trip: StoredTrip
  coverAsset: MediaLibraryAsset | undefined
  onPress: () => void
}

const CARD_WIDTH = Dimensions.get('window').width - 32
const CARD_HEIGHT = 200

function assetUri(asset: MediaLibraryAsset): string {
  return Platform.OS === 'ios' ? `ph://${asset.id}` : asset.id
}

export function TripCard({ trip, coverAsset, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.container}>
      {coverAsset !== undefined ? (
        <Image
          source={{ uri: assetUri(coverAsset) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={coverAsset.id}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
      )}
      <View style={styles.gradient}>
        <Text style={styles.label} numberOfLines={1}>
          {'📍 '}{trip.label}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {trip.subtitle}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#2C2C2E',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 6,
  },
  placeholder: {
    backgroundColor: '#2C2C2E',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0)',
    // simulate gradient: bottom half darkens via a second overlay approach
  },
  label: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
})
