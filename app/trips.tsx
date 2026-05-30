import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { type StoredTrip } from '@/lib/db'
import { impactMedium } from '@/lib/haptics'
import { useGalleryStore } from '@/store/galleryStore'
import { useTripStore } from '@/store/tripStore'
import { TripCard } from '@/features/gallery/components/TripCard'

export default function TripsScreen() {
  const router = useRouter()
  const { trips, isLoading, loadTrips, detectAndSaveTrips } = useTripStore()
  const assets = useGalleryStore((s) => s.assets)
  const [isRegrouping, setIsRegrouping] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const handleRegroup = useCallback(async () => {
    if (isRegrouping || assets.length === 0) return
    setIsRegrouping(true)
    await detectAndSaveTrips(assets)
    await impactMedium()
    if (mountedRef.current) setIsRegrouping(false)
  }, [isRegrouping, assets, detectAndSaveTrips])

  useEffect(() => {
    void loadTrips()
  }, [loadTrips])

  const assetMap = useMemo(() => {
    const map = new Map<string, (typeof assets)[number]>()
    for (const asset of assets) {
      map.set(asset.id, asset)
    }
    return map
  }, [assets])

  function keyExtractor(item: StoredTrip): string {
    return item.id
  }

  function renderItem({ item }: ListRenderItemInfo<StoredTrip>) {
    return (
      <View style={styles.cardWrapper}>
        <TripCard
          trip={item}
          coverAsset={assetMap.get(item.coverAssetId)}
          onPress={() => { router.push(`/trip/${item.id}`) }}
        />
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Trips & Events',
          headerRight: () =>
            isRegrouping ? (
              <ActivityIndicator style={styles.headerSpinner} />
            ) : (
              <Pressable
                onPress={() => { void handleRegroup() }}
                hitSlop={8}
                disabled={assets.length === 0}
              >
                <Text style={[styles.regroupButton, assets.length === 0 && styles.regroupButtonDisabled]}>
                  Regroup
                </Text>
              </Pressable>
            ),
        }}
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No trips detected yet</Text>
          <Text style={styles.emptyBody}>
            Gathr groups your photos automatically after you take a burst of photos over multiple days
          </Text>
        </View>
      ) : (
        <FlashList
          data={trips}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyBody: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
  },
  cardWrapper: {
    marginBottom: 16,
  },
  regroupButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  regroupButtonDisabled: {
    color: '#A8A8AD',
  },
  headerSpinner: {
    marginRight: 4,
  },
})
