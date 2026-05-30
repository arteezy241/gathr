import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'
import { getAlbumAssetIds, getTrip } from '@/lib/db'
import { shareAsset } from '@/lib/sharing'
import { useGalleryStore } from '@/store/galleryStore'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const HIDE_DELAY_MS = 3000

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatPhotoDate(ms: number): string {
  const d = new Date(ms)
  const day = DAY_NAMES[d.getDay()] ?? ''
  const month = MONTH_NAMES[d.getMonth()] ?? ''
  const date = d.getDate()
  const year = d.getFullYear()
  let hours = d.getHours()
  const minutes = d.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  if (hours === 0) hours = 12
  const minStr = String(minutes).padStart(2, '0')
  return `${day}, ${month} ${String(date)}, ${String(year)} · ${String(hours)}:${minStr} ${ampm}`
}

function assetUri(asset: MediaLibraryAsset): string {
  return Platform.OS === 'ios' ? `ph://${asset.id}` : asset.id
}

type PhotoContext = 'gallery' | 'album' | 'trip'

function toPhotoContext(value: string | undefined): PhotoContext | undefined {
  if (value === 'gallery' || value === 'album' || value === 'trip') return value
  return undefined
}

interface ActionButtonProps {
  label: string
  icon: string
  onPress: () => void
  tint?: string
  loading?: boolean
  disabled?: boolean
}

function ActionButton({ label, icon, onPress, tint = '#ffffff', loading = false, disabled = false }: ActionButtonProps) {
  return (
    <Pressable
      style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
      onPress={onPress}
      hitSlop={8}
      disabled={disabled}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tint} style={styles.actionSpinner} />
      ) : (
        <Text style={[styles.actionIcon, { color: tint }]}>{icon}</Text>
      )}
      <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text>
    </Pressable>
  )
}

export default function PhotoDetailScreen() {
  const { id, context: contextParam, contextId } = useLocalSearchParams<{
    id: string
    context?: string
    contextId?: string
  }>()
  const router = useRouter()
  const allAssets = useGalleryStore((s) => s.assets)

  const context = toPhotoContext(contextParam)

  const [contextAssets, setContextAssets] = useState<MediaLibraryAsset[] | null>(null)
  const [currentAssetId, setCurrentAssetId] = useState(id)
  const [isFavorited, setIsFavorited] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [currentDate, setCurrentDate] = useState<string | null>(null)
  const [overlaysVisible, setOverlaysVisible] = useState(true)

  const overlayOpacity = useRef(new Animated.Value(1)).current
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const creationTimeCache = useRef(new Map<string, number>())

  // ── Overlay animation ────────────────────────────────────────────────────

  const showOverlays = useCallback(() => {
    if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current)
    Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    setOverlaysVisible(true)
    hideTimerRef.current = setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => { setOverlaysVisible(false) })
    }, HIDE_DELAY_MS)
  }, [overlayOpacity])

  const toggleOverlays = useCallback(() => {
    if (overlaysVisible) {
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current)
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => { setOverlaysVisible(false) })
    } else {
      showOverlays()
    }
  }, [overlaysVisible, overlayOpacity, showOverlays])

  // Keep a ref so onViewableItemsChanged (stable ref) can call the latest version
  const showOverlaysRef = useRef(showOverlays)
  useEffect(() => { showOverlaysRef.current = showOverlays }, [showOverlays])

  useEffect(() => {
    showOverlays()
    return () => {
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current)
    }
  }, [showOverlays])

  // ── Build context asset list ─────────────────────────────────────────────

  useEffect(() => {
    async function build(): Promise<void> {
      if (context === 'album' && contextId !== undefined) {
        const assetIds = await getAlbumAssetIds(contextId)
        const ordered = assetIds
          .map((aid) => allAssets.find((a) => a.id === aid))
          .filter((a): a is MediaLibraryAsset => a !== undefined)
        setContextAssets(ordered)
      } else if (context === 'trip' && contextId !== undefined) {
        const trip = await getTrip(contextId)
        if (trip === null) {
          setContextAssets([])
          return
        }
        const entries = await Promise.all(
          allAssets.map(async (asset) => {
            const ms = await asset.getCreationTime()
            return { asset, ms }
          }),
        )
        const filtered = entries
          .filter((e): e is { asset: MediaLibraryAsset; ms: number } =>
            e.ms !== null && e.ms >= trip.startDate && e.ms <= trip.endDate,
          )
          .sort((a, b) => a.ms - b.ms)
          .map((e) => e.asset)
        setContextAssets(filtered)
      } else if (context === 'gallery') {
        setContextAssets(allAssets)
      } else {
        // No context — single photo only
        const single = allAssets.find((a) => a.id === id)
        setContextAssets(single !== undefined ? [single] : [])
      }
    }
    void build()
  }, [context, contextId, allAssets, id])

  // ── Resolve creation time for the visible asset ──────────────────────────

  useEffect(() => {
    if (contextAssets === null) return
    const asset = contextAssets.find((a) => a.id === currentAssetId)
    if (asset === undefined) return

    const cached = creationTimeCache.current.get(currentAssetId)
    if (cached !== undefined) {
      setCurrentDate(formatPhotoDate(cached))
      return
    }
    void asset.getCreationTime().then((ms) => {
      if (ms !== null) {
        creationTimeCache.current.set(currentAssetId, ms)
        setCurrentDate(formatPhotoDate(ms))
      }
    })
  }, [currentAssetId, contextAssets])

  // ── FlatList config ──────────────────────────────────────────────────────

  // Stable ref — FlatList warns if this prop changes after mount
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0]
    if (first !== undefined && first.item !== null) {
      const asset = first.item as MediaLibraryAsset
      setCurrentAssetId(asset.id)
      showOverlaysRef.current()
    }
  })

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 })

  const initialIndex =
    contextAssets !== null
      ? Math.max(0, contextAssets.findIndex((a) => a.id === id))
      : 0

  function getItemLayout(
    _data: ArrayLike<MediaLibraryAsset> | null | undefined,
    index: number,
  ) {
    return { length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index }
  }

  function keyExtractor(item: MediaLibraryAsset): string {
    return item.id
  }

  // extraData ensures items re-render when toggleOverlays identity changes (overlaysVisible changed)
  function renderItem({ item }: { item: MediaLibraryAsset }) {
    return (
      <Pressable style={styles.page} onPress={toggleOverlays}>
        <ScrollView
          style={styles.pageScroll}
          contentContainerStyle={styles.pageScrollContent}
          maximumZoomScale={5}
          minimumZoomScale={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          centerContent
          nestedScrollEnabled
        >
          <Image
            source={{ uri: assetUri(item) }}
            style={styles.photo}
            contentFit="contain"
            recyclingKey={item.id}
          />
        </ScrollView>
      </Pressable>
    )
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  const currentAsset = contextAssets?.find((a) => a.id === currentAssetId) ?? null

  async function handleShare(): Promise<void> {
    if (currentAsset === null || isSharing) return
    setIsSharing(true)
    try {
      await shareAsset(currentAsset)
    } catch (e) {
      Alert.alert('Share Failed', e instanceof Error ? e.message : 'An error occurred while sharing.')
    } finally {
      setIsSharing(false)
    }
  }

  function handleDelete() {
    Alert.alert('Delete Photo', 'This photo will be deleted from your library.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          console.log('delete asset:', currentAssetId)
          router.back()
        },
      },
    ])
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (contextAssets !== null && contextAssets.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Photo' }} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Photo not found</Text>
          <Pressable style={styles.backFallback} onPress={() => { router.back() }}>
            <Text style={styles.backFallbackText}>Go back</Text>
          </Pressable>
        </View>
      </>
    )
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        {contextAssets !== null && (
          <FlatList
            data={contextAssets}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={getItemLayout}
            onViewableItemsChanged={onViewableItemsChanged.current}
            viewabilityConfig={viewabilityConfig.current}
            windowSize={3}
            maxToRenderPerBatch={3}
            removeClippedSubviews
            extraData={overlaysVisible}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Header overlay */}
        <Animated.View
          style={[styles.header, { opacity: overlayOpacity }]}
          pointerEvents={overlaysVisible ? 'box-none' : 'none'}
        >
          <Pressable style={styles.headerButton} onPress={() => { router.back() }} hitSlop={12}>
            <Text style={styles.headerIcon}>‹</Text>
          </Pressable>
          <Pressable
            style={styles.headerButton}
            onPress={() => { /* options sheet — later phase */ }}
            hitSlop={12}
          >
            <Text style={styles.headerIcon}>•••</Text>
          </Pressable>
        </Animated.View>

        {/* Footer overlay */}
        <Animated.View
          style={[styles.footer, { opacity: overlayOpacity }]}
          pointerEvents={overlaysVisible ? 'box-none' : 'none'}
        >
          {currentDate !== null && (
            <Text style={styles.dateText}>{currentDate}</Text>
          )}
          <View style={styles.actions}>
            <ActionButton
              label="Share"
              icon="⬆"
              onPress={() => { void handleShare() }}
              loading={isSharing}
              disabled={isSharing || currentAsset === null}
            />
            <ActionButton label="Album" icon="🗂️" onPress={() => { /* later phase */ }} />
            <ActionButton
              label="Favorite"
              icon={isFavorited ? '❤️' : '🤍'}
              onPress={() => { setIsFavorited((prev) => !prev) }}
            />
            <ActionButton label="Delete" icon="🗑️" onPress={handleDelete} tint="#FF453A" />
          </View>
        </Animated.View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000000',
  },
  pageScroll: {
    flex: 1,
  },
  pageScrollContent: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  headerButton: {
    padding: 4,
  },
  headerIcon: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 28,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingTop: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.50)',
  },
  dateText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    gap: 6,
    minWidth: 56,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionSpinner: {
    width: 24,
    height: 24,
  },
  actionLabel: {
    fontSize: 11,
    color: '#ffffff',
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#000000',
  },
  notFoundText: {
    fontSize: 17,
    color: '#8E8E93',
  },
  backFallback: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1C1C1E',
  },
  backFallbackText: {
    color: '#007AFF',
    fontSize: 15,
  },
})
