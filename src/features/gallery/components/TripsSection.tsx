import { useMemo } from 'react'
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useGalleryStore } from '@/store/galleryStore'
import { useTripStore } from '@/store/tripStore'
import { TripCard } from './TripCard'

const CARD_WIDTH = Dimensions.get('window').width - 32
const CARD_HEIGHT = 200

export function TripsSection() {
  const router = useRouter()
  const { trips, isLoading } = useTripStore()
  const assets = useGalleryStore((s) => s.assets)

  const assetMap = useMemo(() => {
    const map = new Map<string, (typeof assets)[number]>()
    for (const asset of assets) {
      map.set(asset.id, asset)
    }
    return map
  }, [assets])

  if (!isLoading && trips.length === 0) return null

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trips & Events</Text>
        <Pressable onPress={() => { router.push('/trips') }} hitSlop={8}>
          <Text style={styles.seeAll}>See All</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {isLoading ? (
          <>
            <View style={styles.placeholder} />
            <View style={styles.placeholder} />
          </>
        ) : (
          trips.map((trip) => (
            <View key={trip.id} style={styles.cardWrapper}>
              <TripCard
                trip={trip}
                coverAsset={assetMap.get(trip.coverAssetId)}
                onPress={() => { router.push(`/trip/${trip.id}`) }}
              />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  seeAll: {
    fontSize: 15,
    color: '#007AFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  cardWrapper: {
    width: CARD_WIDTH,
  },
  placeholder: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    backgroundColor: '#D1D1D6',
    marginRight: 12,
  },
})
