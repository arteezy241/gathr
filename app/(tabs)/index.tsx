import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePermissions } from '@/hooks/usePermissions'
import { useGalleryStore } from '@/store/galleryStore'
import { useSelectionStore } from '@/store/selectionStore'
import { useTripStore } from '@/store/tripStore'
import { useMemoriesStore } from '@/store/memoriesStore'
import { useTripSuggestionStore } from '@/store/tripSuggestionStore'
import { PhotoGrid } from '@/features/gallery/components/PhotoGrid'
import { SelectionBar } from '@/features/gallery/components/SelectionBar'
import { TripsSection } from '@/features/gallery/components/TripsSection'
import { MemoriesSection } from '@/features/gallery/components/MemoriesSection'
import { PhotoSearchResults } from '@/features/gallery/components/PhotoSearchResults'
import { GalleryEmptyState } from '@/features/gallery/components/GalleryEmptyState'
import { PermissionsEmptyState } from '@/components/ui/PermissionsEmptyState'
import { hapticTap } from '@/lib/haptics'
import { useTheme } from '@/lib/themeContext'
import { PILL_HEIGHT, PILL_MARGIN_BOTTOM } from '@/components/ui/FloatingTabBar'
import { radius, type ThemeColors } from '@/lib/theme'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'

function GalleryListHeader() {
  return (
    <View>
      <MemoriesSection />
      <TripsSection />
    </View>
  )
}

interface TitleBarProps {
  onOpenSearch: () => void
  assets: MediaLibraryAsset[]
}

function GalleryTitleBar({ onOpenSearch, assets }: TitleBarProps) {
  const { colors } = useTheme()
  const isSelecting = useSelectionStore((s) => s.isSelecting)
  const selectedIds = useSelectionStore((s) => s.selectedIds)
  const startSelecting = useSelectionStore((s) => s.startSelecting)
  const selectAll = useSelectionStore((s) => s.selectAll)
  const selectByMonth = useSelectionStore((s) => s.selectByMonth)

  async function handleByMonth() {
    hapticTap()
    const first = assets[0]
    if (!first) return
    const ms = await first.getCreationTime()
    if (!ms) return
    const d = new Date(ms)
    const yearMonth = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}`
    void selectByMonth(assets, yearMonth)
  }

  if (isSelecting) {
    const count = selectedIds.size
    return (
      <View style={titleBarStyles.titleBar}>
        <Pressable
          onPress={() => { void handleByMonth() }}
          style={[titleBarStyles.titlePill, { backgroundColor: 'rgba(164,136,190,0.14)' }]}
          hitSlop={8}
        >
          <Text style={[titleBarStyles.titlePillText, { color: colors.accent }]}>By month</Text>
        </Pressable>
        <Text style={[titleBarStyles.selCount, { color: colors.textSecondary }]}>
          {count > 0 ? `${String(count)} selected` : 'Tap to select'}
        </Text>
        <Pressable
          onPress={() => { hapticTap(); selectAll(assets.map((a) => a.id)) }}
          style={[titleBarStyles.titlePill, { backgroundColor: 'rgba(164,136,190,0.14)' }]}
          hitSlop={8}
        >
          <Text style={[titleBarStyles.titlePillText, { color: colors.accent }]}>All</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={titleBarStyles.titleBar}>
      <Text style={[titleBarStyles.title, { color: colors.text }]}>All Photos</Text>
      <View style={titleBarStyles.titleActions}>
        <Pressable onPress={onOpenSearch} hitSlop={10}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
        </Pressable>
        <Pressable
          onPress={() => { hapticTap(); startSelecting() }}
          hitSlop={10}
        >
          <Text style={[titleBarStyles.selectBtn, { color: colors.accent }]}>Select</Text>
        </Pressable>
      </View>
    </View>
  )
}

export default function GalleryScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { granted, requesting } = usePermissions()
  const assets = useGalleryStore((s) => s.assets)
  const { trips, lastGroupedAt, detectAndSaveTrips, loadTrips } = useTripStore()
  const { load: loadMemories } = useMemoriesStore()
  // Tracks which lastGroupedAt value we last loaded memories for (undefined = never loaded)
  const memoriesGroupedAtRef = useRef<number | null | undefined>(undefined)
  const { loadSuggestions } = useTripSuggestionStore()

  const [searchActive, setSearchActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<TextInput>(null)
  const searchBarHeight = useRef(new Animated.Value(0)).current

  function openSearch() {
    setSearchActive(true)
    Animated.spring(searchBarHeight, { toValue: 1, useNativeDriver: false, speed: 28, bounciness: 0 }).start(() => {
      searchInputRef.current?.focus()
    })
  }

  function closeSearch() {
    searchInputRef.current?.blur()
    setSearchQuery('')
    Animated.spring(searchBarHeight, { toValue: 0, useNativeDriver: false, speed: 28, bounciness: 0 }).start(() => {
      setSearchActive(false)
    })
  }

  const bottomPad = insets.bottom + PILL_MARGIN_BOTTOM + PILL_HEIGHT + 8
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])

  // Populate trips from DB on mount so memories can include trip memories
  useEffect(() => {
    void loadTrips()
  }, [loadTrips])

  useEffect(() => {
    if (assets.length > 0 && lastGroupedAt === null) {
      void detectAndSaveTrips(assets)
    }
  }, [assets, lastGroupedAt, detectAndSaveTrips])

  // Load memories on mount, then reload after each trip detection pass
  useEffect(() => {
    if (memoriesGroupedAtRef.current !== lastGroupedAt) {
      memoriesGroupedAtRef.current = lastGroupedAt
      void loadMemories(trips)
    }
  }, [trips, lastGroupedAt, loadMemories])

  // Load trip-to-album suggestions whenever trips change
  useEffect(() => {
    if (trips.length > 0) {
      void loadSuggestions(trips)
    }
  }, [trips, loadSuggestions])

  if (!requesting && !granted) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.screen}>
          <PermissionsEmptyState />
        </View>
      </>
    )
  }

  const searchBarH = searchBarHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 48] })

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        {/* Gallery title bar — switches between normal and selection mode */}
        {!searchActive && (
          <GalleryTitleBar onOpenSearch={openSearch} assets={assets} />
        )}

        {/* Search bar — animates in/out when search is active */}
        <Animated.View style={[styles.searchRow, { height: searchBarH, overflow: 'hidden' }]}>
          <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, { color: colors.text }]}
              placeholder='Try "2024" or "March 2023"'
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => { setSearchQuery('') }} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
          <Pressable onPress={closeSearch} style={styles.searchCancel} hitSlop={8}>
            <Text style={[styles.searchCancelText, { color: colors.accent }]}>Cancel</Text>
          </Pressable>
        </Animated.View>

        {searchActive
          ? <PhotoSearchResults query={searchQuery} contentBottomPad={bottomPad} />
          : <PhotoGrid listHeader={<GalleryListHeader />} contentBottomPad={bottomPad} emptyComponent={<GalleryEmptyState />} />
        }

        <SelectionBar />
      </View>
    </>
  )
}

const titleBarStyles = StyleSheet.create({
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  selectBtn: {
    fontSize: 14,
    fontWeight: '500',
  },
  titlePill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  titlePillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  selCount: {
    fontSize: 13,
    fontWeight: '500',
  },
})

function makeStyles(colors: ThemeColors, topPad: number) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: topPad,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      gap: 10,
    },
    searchBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      height: 36,
      borderRadius: radius.lg,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      paddingVertical: 0,
    },
    searchCancel: {
      paddingVertical: 6,
    },
    searchCancelText: {
      fontSize: 15,
      fontWeight: '500',
    },
  })
}
