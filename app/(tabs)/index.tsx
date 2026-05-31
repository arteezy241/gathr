import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePermissions } from '@/hooks/usePermissions'
import { useGalleryStore } from '@/store/galleryStore'
import { useTripStore } from '@/store/tripStore'
import { useMemoriesStore } from '@/store/memoriesStore'
import { useTripSuggestionStore } from '@/store/tripSuggestionStore'
import { PhotoGrid } from '@/features/gallery/components/PhotoGrid'
import { SelectionBar } from '@/features/gallery/components/SelectionBar'
import { TripsSection } from '@/features/gallery/components/TripsSection'
import { MemoriesSection } from '@/features/gallery/components/MemoriesSection'
import { TripSuggestions } from '@/features/gallery/components/TripSuggestions'
import { PhotoSearchResults } from '@/features/gallery/components/PhotoSearchResults'
import { useTheme } from '@/lib/themeContext'
import { PILL_HEIGHT, PILL_MARGIN_BOTTOM } from '@/components/ui/FloatingTabBar'
import { radius, spacing, typography, type ThemeColors } from '@/lib/theme'

function GalleryHeader() {
  return (
    <View>
      <MemoriesSection />
      <TripSuggestions />
      <TripsSection />
    </View>
  )
}

export default function GalleryScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { granted, requesting, request } = usePermissions()
  const assets = useGalleryStore((s) => s.assets)
  const { trips, lastGroupedAt, detectAndSaveTrips } = useTripStore()
  const { load: loadMemories, loadedAt: memoriesLoadedAt } = useMemoriesStore()
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

  useEffect(() => {
    if (assets.length > 0 && lastGroupedAt === null) {
      void detectAndSaveTrips(assets)
    }
  }, [assets, lastGroupedAt, detectAndSaveTrips])

  // Load memories once trips are available
  useEffect(() => {
    if (memoriesLoadedAt === null && trips.length >= 0) {
      void loadMemories(trips)
    }
  }, [trips, memoriesLoadedAt, loadMemories])

  // Load trip-to-album suggestions whenever trips change
  useEffect(() => {
    if (trips.length > 0) {
      void loadSuggestions(trips)
    }
  }, [trips, loadSuggestions])

  if (requesting) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered} />
      </>
    )
  }

  if (!granted) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <Text style={styles.permissionTitle}>Photo Access Required</Text>
          <Text style={styles.permissionBody}>
            Gathr needs access to your photo library to display and organize your photos.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={() => { void request() }}>
            <Text style={styles.permissionButtonText}>Allow Access</Text>
          </TouchableOpacity>
        </View>
      </>
    )
  }

  const searchBarH = searchBarHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 48] })

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        {/* Search bar — animates in/out below the safe area */}
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
          : <PhotoGrid listHeader={<GalleryHeader />} contentBottomPad={bottomPad} />
        }

        {/* Search icon — only shown when not searching */}
        {!searchActive && (
          <Pressable style={[styles.searchFab, { bottom: bottomPad + 12 }]} onPress={openSearch} hitSlop={8}>
            <Ionicons name="search" size={20} color={colors.accent} />
          </Pressable>
        )}

        <SelectionBar />
      </View>
    </>
  )
}

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
    searchFab: {
      position: 'absolute',
      right: 16,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      backgroundColor: colors.background,
    },
    permissionTitle: {
      ...typography.headline,
      color: colors.text,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    permissionBody: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 28,
    },
    permissionButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 12,
    },
    permissionButtonText: {
      color: '#FFFFFF',
      ...typography.title,
    },
  })
}
