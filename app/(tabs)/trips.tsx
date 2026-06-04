import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useGalleryStore } from '@/store/galleryStore'
import { useTripStore } from '@/store/tripStore'
import { useTripSuggestionStore } from '@/store/tripSuggestionStore'
import { useMemoriesStore } from '@/store/memoriesStore'
import { TripCard } from '@/features/gallery/components/TripCard'
import { MemoriesSection } from '@/features/gallery/components/MemoriesSection'
import { TripsEmptyState } from '@/features/gallery/components/TripsEmptyState'
import { PermissionsEmptyState } from '@/components/ui/PermissionsEmptyState'
import { clusterByPlace } from '@/features/gallery/components/TripsSection'
import { usePermissions } from '@/hooks/usePermissions'
import { PILL_HEIGHT, PILL_MARGIN_BOTTOM } from '@/components/ui/FloatingTabBar'
import { useTheme } from '@/lib/themeContext'
import { type ThemeColors } from '@/lib/theme'

export default function TripsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { granted, requesting } = usePermissions()
  const { trips, isLoading, loadTrips } = useTripStore()
  const assets = useGalleryStore((s) => s.assets)
  const { suggestions, saving, saveSuggestionAsAlbum, loadSuggestions } = useTripSuggestionStore()
  const { memories } = useMemoriesStore()

  const [searchVisible, setSearchVisible] = useState(false)
  const [query, setQuery] = useState('')
  const mountedRef = useRef(true)

  const bottomPad = insets.bottom + PILL_MARGIN_BOTTOM + PILL_HEIGHT + 8
  const styles = useMemo(() => makeStyles(colors), [colors])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    void loadTrips()
  }, [loadTrips])

  useEffect(() => {
    if (trips.length > 0) {
      void loadSuggestions(trips)
    }
  }, [trips, loadSuggestions])

  const suggestionIds = useMemo(() => new Set(suggestions.map((s) => s.trip.id)), [suggestions])

  const assetMap = useMemo(() => {
    const map = new Map<string, (typeof assets)[number]>()
    for (const asset of assets) map.set(asset.id, asset)
    return map
  }, [assets])

  const clusters = useMemo(() => clusterByPlace(trips), [trips])

  const filteredClusters = useMemo(() => {
    if (query.trim().length === 0) return clusters
    const q = query.toLowerCase()
    return clusters.filter(
      ({ representativeTrip: t }) =>
        t.label.toLowerCase().includes(q) ||
        t.subtitle.toLowerCase().includes(q) ||
        (t.place ?? '').toLowerCase().includes(q),
    )
  }, [clusters, query])

  const toggleSearch = useCallback(() => {
    setSearchVisible((v) => {
      if (v) setQuery('')
      return !v
    })
  }, [])

  const hasMemories = memories.length > 0

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {!requesting && !granted ? (
          <PermissionsEmptyState />
        ) : (
          <>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Trips & Events</Text>
              <Pressable onPress={toggleSearch} hitSlop={10}>
                <Ionicons
                  name={searchVisible ? 'close' : 'search'}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            {/* Search bar */}
            {searchVisible && (
              <View style={styles.searchWrap}>
                <TextInput
                  style={styles.searchBar}
                  placeholder="Search trips…"
                  placeholderTextColor={colors.textTertiary}
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                  autoCorrect={false}
                  returnKeyType="search"
                />
              </View>
            )}

            {isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            ) : trips.length === 0 ? (
              <TripsEmptyState />
            ) : (
              <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
                showsVerticalScrollIndicator={false}
              >
                {/* Memories — MemoriesSection renders its own title */}
                {hasMemories && (
                  <View style={styles.memoriesWrap}>
                    <MemoriesSection />
                  </View>
                )}

                {/* Section label */}
                <Text style={styles.sectionLabel}>Recent Trips</Text>

                {/* Trip cards */}
                <View style={styles.cardList}>
                  {filteredClusters.map(({ representativeTrip: trip }, index) => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      coverAsset={assetMap.get(trip.coverAssetId)}
                      large={index === 0}
                      onPress={() => { router.push(`/trip/${trip.id}`) }}
                      isSavingAlbum={saving === trip.id}
                      inAlbums={!suggestionIds.has(trip.id)}
                      {...(suggestionIds.has(trip.id) && {
                        onSaveAsAlbum: () => { void saveSuggestionAsAlbum({ trip }) },
                      })}
                    />
                  ))}
                </View>
              </ScrollView>
            )}
          </>
        )}
      </View>
    </>
  )
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      letterSpacing: -0.6,
      color: colors.text,
    },
    searchWrap: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    searchBar: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 9,
      fontSize: 15,
      color: colors.text,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      paddingTop: 4,
    },
    memoriesWrap: {
      marginBottom: 24,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '500',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textTertiary,
      paddingHorizontal: 20,
      paddingBottom: 14,
    },
    cardList: {
      paddingHorizontal: 16,
      gap: 14,
    },
  })
}
