import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { type StoredTrip } from '@/lib/db'
import { hapticDone } from '@/lib/haptics'
import { useGalleryStore } from '@/store/galleryStore'
import { useTripStore } from '@/store/tripStore'
import { TripCard } from '@/features/gallery/components/TripCard'
import { TripsEmptyState } from '@/features/gallery/components/TripsEmptyState'
import { PermissionsEmptyState } from '@/components/ui/PermissionsEmptyState'
import { useTheme } from '@/lib/themeContext'
import { usePermissions } from '@/hooks/usePermissions'
import { PILL_HEIGHT, PILL_MARGIN_BOTTOM } from '@/components/ui/FloatingTabBar'
import { radius, spacing, typography, type ThemeColors } from '@/lib/theme'

export default function TripsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { granted, requesting } = usePermissions()
  const { trips, isLoading, loadTrips, detectAndSaveTrips } = useTripStore()
  const assets = useGalleryStore((s) => s.assets)
  const [isRegrouping, setIsRegrouping] = useState(false)
  const [query, setQuery] = useState('')
  const mountedRef = useRef(true)

  const bottomPad = insets.bottom + PILL_MARGIN_BOTTOM + PILL_HEIGHT + 8
  const styles = useMemo(() => makeStyles(colors, insets.top, bottomPad), [colors, insets.top, bottomPad])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const handleRegroup = useCallback(async () => {
    if (isRegrouping || assets.length === 0) return
    setIsRegrouping(true)
    await detectAndSaveTrips(assets)
    await hapticDone()
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
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        {!requesting && !granted ? (
          <PermissionsEmptyState />
        ) : isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : trips.length === 0 ? (
          <TripsEmptyState />
        ) : (
          <FlashList
            data={filteredTrips}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <View style={styles.titleRow}>
                  <Text style={styles.screenTitle}>Trips & Events</Text>
                  <Pressable
                    onPress={() => { void handleRegroup() }}
                    hitSlop={8}
                    disabled={assets.length === 0 || isRegrouping}
                  >
                    {isRegrouping
                      ? <ActivityIndicator color={colors.accent} />
                      : <Text style={[styles.regroupButton, assets.length === 0 && styles.regroupButtonDisabled]}>Regroup</Text>
                    }
                  </Pressable>
                </View>
                <TextInput
                  style={styles.searchBar}
                  placeholder="Search trips…"
                  placeholderTextColor={colors.textTertiary}
                  value={query}
                  onChangeText={setQuery}
                  clearButtonMode="while-editing"
                  autoCorrect={false}
                />
              </View>
            }
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </>
  )
}

function makeStyles(colors: ThemeColors, topPad: number, bottomPad: number) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: topPad,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    listHeader: {
      padding: spacing.md,
      paddingBottom: 0,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    screenTitle: {
      ...typography.headline,
      color: colors.text,
    },
    listContent: {
      padding: spacing.md,
      paddingBottom: bottomPad,
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
  })
}
