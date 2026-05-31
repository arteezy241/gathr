import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { type StoredTrip } from '@/lib/db'
import { impactMedium } from '@/lib/haptics'
import { useGalleryStore } from '@/store/galleryStore'
import { useTripStore } from '@/store/tripStore'
import { TripCard } from '@/features/gallery/components/TripCard'
import { useTheme } from '@/lib/themeContext'
import { radius, spacing, typography, type ThemeColors } from '@/lib/theme'

export default function TripsScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const { trips, isLoading, loadTrips, detectAndSaveTrips } = useTripStore()
  const assets = useGalleryStore((s) => s.assets)
  const [isRegrouping, setIsRegrouping] = useState(false)
  const [query, setQuery] = useState('')
  const mountedRef = useRef(true)

  const styles = useMemo(() => makeStyles(colors), [colors])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const handleRegroup = useCallback(async () => {
    if (isRegrouping || assets.length === 0) return
    setIsRegrouping(true)
    await detectAndSaveTrips(assets)
    impactMedium()
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

  const filteredTrips = query.trim().length > 0
    ? trips.filter((t) =>
        t.label.toLowerCase().includes(query.toLowerCase()) ||
        t.subtitle.toLowerCase().includes(query.toLowerCase()),
      )
    : trips

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
          <ActivityIndicator size="large" color={colors.accent} />
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
          data={filteredTrips}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={
            <TextInput
              style={styles.searchBar}
              placeholder="Search trips…"
              placeholderTextColor={colors.textTertiary}
              value={query}
              onChangeText={setQuery}
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </>
  )
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    emptyTitle: {
      ...typography.title,
      fontSize: 18,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 10,
    },
    emptyBody: {
      ...typography.body,
      fontSize: 14,
      color: colors.textTertiary,
      textAlign: 'center',
      lineHeight: 20,
    },
    listContent: {
      padding: spacing.md,
    },
    searchBar: {
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      fontSize: 15,
      color: colors.text,
    },
    cardWrapper: {
      marginBottom: spacing.md,
    },
    regroupButton: {
      fontSize: 16,
      color: colors.accent,
    },
    regroupButtonDisabled: {
      color: colors.textTertiary,
    },
    headerSpinner: {
      marginRight: 4,
    },
  })
}
