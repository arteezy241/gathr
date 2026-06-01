import { useMemo } from 'react'
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useGalleryStore } from '@/store/galleryStore'
import { useTripStore } from '@/store/tripStore'
import { useTripSuggestionStore } from '@/store/tripSuggestionStore'
import { type StoredTrip } from '@/lib/db'
import { Skeleton } from '@/components/ui/Skeleton'
import { useTheme } from '@/lib/themeContext'
import { radius, spacing, typography, type ThemeColors } from '@/lib/theme'
import { TripCard } from './TripCard'

const CARD_WIDTH = Dimensions.get('window').width - 32
const CARD_HEIGHT = 200

/** One representative trip per place (most recent), with a count if clustered. */
type TripCluster = {
  representativeTrip: StoredTrip
  count: number
}

function clusterByPlace(trips: StoredTrip[]): TripCluster[] {
  const placeMap = new Map<string, StoredTrip[]>()
  const noPlace: StoredTrip[] = []

  for (const trip of trips) {
    if (trip.place !== null) {
      const key = trip.place.toLowerCase()
      const existing = placeMap.get(key) ?? []
      existing.push(trip)
      placeMap.set(key, existing)
    } else {
      noPlace.push(trip)
    }
  }

  const clusters: TripCluster[] = []

  // Place clusters — show most recent trip as representative
  for (const group of placeMap.values()) {
    const sorted = [...group].sort((a, b) => b.startDate - a.startDate)
    const rep = sorted[0]
    if (rep !== undefined) clusters.push({ representativeTrip: rep, count: group.length })
  }

  // Ungrouped trips (no location data)
  for (const trip of noPlace) {
    clusters.push({ representativeTrip: trip, count: 1 })
  }

  // Sort clusters by most recent trip date
  return clusters.sort((a, b) => b.representativeTrip.startDate - a.representativeTrip.startDate)
}

export function TripsSection() {
  const router = useRouter()
  const { colors } = useTheme()
  const { trips, isLoading } = useTripStore()
  const assets = useGalleryStore((s) => s.assets)
  const { suggestions, saving, saveSuggestionAsAlbum } = useTripSuggestionStore()
  const suggestionIds = useMemo(() => new Set(suggestions.map((s) => s.trip.id)), [suggestions])

  const styles = useMemo(() => makeStyles(colors), [colors])

  const assetMap = useMemo(() => {
    const map = new Map<string, (typeof assets)[number]>()
    for (const asset of assets) {
      map.set(asset.id, asset)
    }
    return map
  }, [assets])

  const clusters = useMemo(() => clusterByPlace(trips), [trips])

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
            <Skeleton width={CARD_WIDTH} height={CARD_HEIGHT} borderRadius={radius.lg} />
            <Skeleton width={CARD_WIDTH} height={CARD_HEIGHT} borderRadius={radius.lg} />
          </>
        ) : (
          clusters.map(({ representativeTrip: trip, count }) => (
            <View key={trip.id} style={styles.cardWrapper}>
              <TripCard
                trip={trip}
                coverAsset={assetMap.get(trip.coverAssetId)}
                onPress={() => { router.push(`/trip/${trip.id}`) }}
                isSavingAlbum={saving === trip.id}
                {...(suggestionIds.has(trip.id) && {
                  onSaveAsAlbum: () => { void saveSuggestionAsAlbum({ trip }) },
                })}
              />
              {count > 1 && (
                <View style={styles.clusterBadge}>
                  <Text style={styles.clusterText}>{count} trips</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
      ...typography.headline,
      fontSize: 20,
      color: colors.text,
    },
    seeAll: {
      ...typography.body,
      color: colors.accent,
    },
    scrollContent: {
      paddingHorizontal: 16,
      gap: 12,
    },
    cardWrapper: {
      width: CARD_WIDTH,
    },
    clusterBadge: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    clusterText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  })
}
