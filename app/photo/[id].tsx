import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Asset, type MediaLibraryAsset, MediaType, getPhotosByDateRange } from '@/lib/mediaLibrary'
import { GlassView } from '@/components/ui/GlassView'
import { BlurView } from 'expo-blur'
import { getAlbumAssetIds, getTrip, getAssetIdsForCluster, removeAssetsFromAlbum, updateAlbumCover } from '@/lib/db'
import { shareAsset } from '@/lib/sharing'
import { createAsset } from '@/lib/mediaLibrary'
import { hapticWarning } from '@/lib/haptics'
import { ImageManipulator, FlipType, SaveFormat } from 'expo-image-manipulator'
import { useGalleryStore } from '@/store/galleryStore'
import { useAlbumStore } from '@/store/albumStore'
import { useFavoriteStore } from '@/store/favoriteStore'
import { useTrashStore } from '@/store/trashStore'
import { useUndoToast } from '@/components/ui/UndoToast'

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

const ZOOM_IN_SCALE = 2.5
const MAX_SCALE = 5
const MIN_SCALE = 1

interface PhotoPageProps {
  item: MediaLibraryAsset
  onSingleTap: () => void
  onZoomChange: (zoomed: boolean) => void
}

function PhotoPage({ item, onSingleTap, onZoomChange }: PhotoPageProps) {
  const [isZoomed, setIsZoomed] = useState(false)
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)
  // Worklet-side flag so runOnJS only fires when zoomed state actually changes
  const isZoomedShared = useSharedValue(false)

  const handleZoomChange = useCallback((zoomed: boolean) => {
    setIsZoomed(zoomed)
    onZoomChange(zoomed)
  }, [onZoomChange])

  function clampTranslation(tx: number, ty: number, currentScale: number) {
    'worklet'
    const maxX = (SCREEN_WIDTH * (currentScale - 1)) / 2
    const maxY = (SCREEN_HEIGHT * (currentScale - 1)) / 2
    return {
      x: Math.max(-maxX, Math.min(maxX, tx)),
      y: Math.max(-maxY, Math.min(maxY, ty)),
    }
  }

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, savedScale.value * e.scale))
      scale.value = next
      const nowZoomed = next > 1.05
      if (nowZoomed !== isZoomedShared.value) {
        isZoomedShared.value = nowZoomed
        scheduleOnRN(handleZoomChange, nowZoomed)
      }
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        scale.value = withSpring(1, { damping: 40, stiffness: 300, overshootClamping: true })
        translateX.value = withSpring(0, { damping: 40, stiffness: 300, overshootClamping: true })
        translateY.value = withSpring(0, { damping: 40, stiffness: 300, overshootClamping: true })
        savedScale.value = 1
        savedTranslateX.value = 0
        savedTranslateY.value = 0
        if (isZoomedShared.value) {
          isZoomedShared.value = false
          scheduleOnRN(handleZoomChange, false)
        }
      } else {
        savedScale.value = scale.value
      }
    })

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value <= 1.05) return
      const clamped = clampTranslation(
        savedTranslateX.value + e.translationX,
        savedTranslateY.value + e.translationY,
        scale.value,
      )
      translateX.value = clamped.x
      translateY.value = clamped.y
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > 1.05) {
        // Zoom out
        scale.value = withSpring(1, { damping: 40, stiffness: 300, overshootClamping: true })
        translateX.value = withSpring(0, { damping: 40, stiffness: 300, overshootClamping: true })
        translateY.value = withSpring(0, { damping: 40, stiffness: 300, overshootClamping: true })
        savedScale.value = 1
        savedTranslateX.value = 0
        savedTranslateY.value = 0
        isZoomedShared.value = false
        scheduleOnRN(handleZoomChange, false)
      } else {
        // Zoom in centered on tap
        const targetScale = ZOOM_IN_SCALE
        const tapX = e.x - SCREEN_WIDTH / 2
        const tapY = e.y - SCREEN_HEIGHT / 2
        const tx = -tapX * (targetScale - 1)
        const ty = -tapY * (targetScale - 1)
        const clamped = clampTranslation(tx, ty, targetScale)
        scale.value = withSpring(targetScale, { damping: 40, stiffness: 300, overshootClamping: true })
        translateX.value = withSpring(clamped.x, { damping: 40, stiffness: 300, overshootClamping: true })
        translateY.value = withSpring(clamped.y, { damping: 40, stiffness: 300, overshootClamping: true })
        savedScale.value = targetScale
        savedTranslateX.value = clamped.x
        savedTranslateY.value = clamped.y
        isZoomedShared.value = true
        scheduleOnRN(handleZoomChange, true)
      }
    })

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      scheduleOnRN(onSingleTap)
    })

  // Double tap takes priority over single tap
  const tapGesture = Gesture.Exclusive(doubleTap, singleTap)
  // Pan only joins when zoomed — otherwise it consumes horizontal swipes and breaks FlatList paging
  const composed = isZoomed
    ? Gesture.Simultaneous(pinchGesture, panGesture, tapGesture)
    : Gesture.Simultaneous(pinchGesture, tapGesture)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  return (
    <View style={styles.page}>
      <GestureDetector gesture={composed}>
        <Reanimated.View style={[styles.page, animatedStyle]}>
          <Image
            source={{ uri: assetUri(item) }}
            style={styles.photo}
            contentFit="contain"
            recyclingKey={item.id}
            transition={250}
          />
        </Reanimated.View>
      </GestureDetector>
    </View>
  )
}

function MediaPage({ item, onSingleTap, onZoomChange }: PhotoPageProps) {
  const [isVideo, setIsVideo] = useState(false)

  useEffect(() => {
    let cancelled = false
    void item.getMediaType().then((type) => {
      if (!cancelled) setIsVideo(type === MediaType.VIDEO)
    })
    return () => { cancelled = true }
  }, [item])

  if (isVideo) {
    return <VideoPage item={item} onTap={onSingleTap} />
  }
  return <PhotoPage item={item} onSingleTap={onSingleTap} onZoomChange={onZoomChange} />
}

function VideoPlayerReady({ uri, onTap }: { uri: string; onTap: () => void }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false })

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [ready, setReady] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const scrubberWidthRef = useRef(1)
  const playerRef = useRef(player)
  const durationRef = useRef(0)
  playerRef.current = player

  const scrubberPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      if (durationRef.current === 0) return
      const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / scrubberWidthRef.current))
      playerRef.current.currentTime = pct * durationRef.current
      setCurrentTime(pct * durationRef.current)
    },
    onPanResponderMove: (e) => {
      if (durationRef.current === 0) return
      const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / scrubberWidthRef.current))
      playerRef.current.currentTime = pct * durationRef.current
      setCurrentTime(pct * durationRef.current)
    },
  })).current

  useEffect(() => {
    const subs = [
      player.addListener('statusChange', ({ status }) => {
        if (status === 'readyToPlay') {
          setReady(true)
          durationRef.current = player.duration
          setDuration(player.duration)
        }
      }),
      player.addListener('playingChange', ({ isPlaying: playing }) => {
        setIsPlaying(playing)
      }),
    ]
    return () => { subs.forEach((s) => { s.remove() }) }
  }, [player])

  // Poll currentTime while playing, stop when paused
  useEffect(() => {
    if (!isPlaying) return
    const id = setInterval(() => { setCurrentTime(player.currentTime) }, 250)
    return () => { clearInterval(id) }
  }, [player, isPlaying])

  useEffect(() => {
    return () => {
      try { player.pause() } catch { /* released */ }
    }
  }, [player])

  function toggleControls() {
    setControlsVisible((v) => !v)
  }

  function handlePlayPause() {
    if (isPlaying) {
      player.pause()
    } else {
      player.play()
    }
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${String(m)}:${String(sec).padStart(2, '0')}`
  }

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0

  return (
    <View style={styles.page}>
      <VideoView
        player={player}
        style={styles.photo}
        contentFit="contain"
        nativeControls={false}
        {...(Platform.OS === 'android' ? { surfaceType: 'textureView' as const } : {})}
      />

      {/* Transparent tap layer — toggles both video controls and photo viewer overlays */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => { toggleControls(); onTap() }} />

      {!ready && (
        <View style={[StyleSheet.absoluteFill, styles.centered]} pointerEvents="none">
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}

      {ready && controlsVisible && (
        <>
          {/* Play/pause pill — centred */}
          <View style={[StyleSheet.absoluteFill, styles.centered]} pointerEvents="box-none">
            <Pressable onPress={handlePlayPause} style={styles.playPill}>
              <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={22}
                color="#fff"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.playPillTime}>
                {isPlaying ? fmt(currentTime) : fmt(duration)}
              </Text>
            </Pressable>
          </View>

          {/* Scrubber + time pill — bottom */}
          <View style={styles.videoBottom}>
            <View style={styles.scrubberPill}>
              <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
              <Text style={styles.scrubberTime}>{fmt(currentTime)}</Text>
              <View
                style={styles.scrubberTrack}
                onLayout={(e) => {
                  scrubberWidthRef.current = e.nativeEvent.layout.width
                }}
                {...scrubberPan.panHandlers}
              >
                <View style={styles.scrubberBg} />
                <View style={[styles.scrubberFill, { width: `${String(Math.round(progress * 100))}%` as `${number}%` }]} />
                <View style={[styles.scrubberThumb, { left: `${String(Math.round(progress * 100))}%` as `${number}%` }]} />
              </View>
              <Text style={styles.scrubberTime}>{fmt(duration)}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  )
}

function VideoPage({ item, onTap }: { item: MediaLibraryAsset; onTap: () => void }) {
  const [uri, setUri] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void item.getUri().then((u) => { if (!cancelled) setUri(u) })
    return () => { cancelled = true }
  }, [item])

  if (uri === null) {
    return (
      <View style={[styles.page, styles.centered]}>
        <ActivityIndicator color="#ffffff" />
      </View>
    )
  }

  return <VideoPlayerReady uri={uri} onTap={onTap} />
}

type PhotoContext = 'gallery' | 'album' | 'trip' | 'memory' | 'person'

function toPhotoContext(value: string | undefined): PhotoContext | undefined {
  if (value === 'gallery' || value === 'album' || value === 'trip' || value === 'memory' || value === 'person') return value
  return undefined
}

function memoryDateRange(memoryId: string): { startMs: number; endMs: number } | null {
  const match = /onthisday-(\d{4})/.exec(memoryId)
  if (match === null || match[1] === undefined) return null
  const year = parseInt(match[1], 10)
  const now = new Date()
  const m = now.getMonth()
  const d = now.getDate()
  return {
    startMs: new Date(year, m, d, 0, 0, 0, 0).getTime(),
    endMs: new Date(year, m, d, 23, 59, 59, 999).getTime(),
  }
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

interface ActionButtonProps {
  label: string
  icon: IoniconName
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
        <Ionicons name={icon} size={26} color={tint} />
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
  const removeAssets = useGalleryStore((s) => s.removeAssets)
  const { albums, loadAlbums, addAssetsToAlbum } = useAlbumStore()
  const { favoriteIds, loadFavorites, toggleFavorite } = useFavoriteStore()
  const { showToast } = useUndoToast()

  const context = toPhotoContext(contextParam)

  // For gallery context, initialize synchronously so FlatList renders on first frame
  const [contextAssets, setContextAssets] = useState<MediaLibraryAsset[] | null>(
    () => (toPhotoContext(contextParam) === 'gallery' ? allAssets : null)
  )
  const [currentAssetId, setCurrentAssetId] = useState(id)
  const [isSharing, setIsSharing] = useState(false)
  const [currentDate, setCurrentDate] = useState<string | null>(null)
  const [overlaysVisible, setOverlaysVisible] = useState(true)
  const [isZoomed, setIsZoomed] = useState(false)

  const overlayOpacity = useRef(new Animated.Value(1)).current
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const creationTimeCache = useRef(new Map<string, number>())

  // ── Overlay animation ────────────────────────────────────────────────────

  const showOverlays = useCallback(() => {
    if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current)
    Animated.timing(overlayOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start()
    setOverlaysVisible(true)
    hideTimerRef.current = setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => { setOverlaysVisible(false) })
    }, HIDE_DELAY_MS)
  }, [overlayOpacity])

  const toggleOverlays = useCallback(() => {
    if (overlaysVisible) {
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current)
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 160,
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

  // Defer DB loads until after the screen transition finishes
  useEffect(() => {
    const id = setTimeout(() => {
      void loadFavorites()
      void loadAlbums()
    }, 50)
    return () => { clearTimeout(id) }
  }, [loadFavorites, loadAlbums])

  // ── Build context asset list ─────────────────────────────────────────────

  useEffect(() => {
    async function build(): Promise<void> {
      if (context === 'album' && contextId !== undefined) {
        const assetIds = await getAlbumAssetIds(contextId)
        setContextAssets(assetIds.map((aid) => new Asset(aid)))
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
      } else if (context === 'person' && contextId !== undefined) {
        const assetIds = await getAssetIdsForCluster(contextId)
        setContextAssets(assetIds.map((aid) => new Asset(aid)))
      } else if (context === 'memory' && contextId !== undefined) {
        const range = memoryDateRange(contextId)
        if (range !== null) {
          const assets = await getPhotosByDateRange(range.startMs, range.endMs, 200)
          setContextAssets(assets)
        } else {
          setContextAssets([new Asset(id)])
        }
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

  const getItemLayout = useCallback((
    _data: ArrayLike<MediaLibraryAsset> | null | undefined,
    index: number,
  ) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index }), [])

  const keyExtractor = useCallback((item: MediaLibraryAsset) => item.id, [])

  const renderItem = useCallback(({ item }: { item: MediaLibraryAsset }) => (
    <MediaPage
      item={item}
      onSingleTap={toggleOverlays}
        onZoomChange={setIsZoomed}
      />
  ), [toggleOverlays, setIsZoomed])

  // ── Actions ──────────────────────────────────────────────────────────────

  const currentAsset = contextAssets?.find((a) => a.id === currentAssetId) ?? null
  const isFavorited = favoriteIds.has(currentAssetId)

  function handleAddToAlbum() {
    const publicAlbums = albums.filter((a) => !a.isPrivate)
    if (publicAlbums.length === 0) {
      Alert.alert('No Albums', 'Create an album first from the Albums tab.')
      return
    }
    const buttons = [
      ...publicAlbums.map((album) => ({
        text: album.name,
        onPress: () => {
          void addAssetsToAlbum(album.id, [currentAssetId]).then(() => {
            Alert.alert('Added', `Added to ${album.name}`)
          })
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]
    Alert.alert('Add to Album', 'Choose an album', buttons)
  }

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

  async function applyEdit(actions: Array<{ rotate: number } | { flip: FlipType }>): Promise<void> {
    if (currentAsset === null) return
    try {
      const uri = await currentAsset.getUri()
      let ctx = ImageManipulator.manipulate(uri)
      for (const action of actions) {
        if ('rotate' in action) ctx = ctx.rotate(action.rotate)
        else ctx = ctx.flip(action.flip)
      }
      const ref = await ctx.renderAsync()
      const result = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 })
      await createAsset(result.uri)
    } catch (e) {
      Alert.alert('Edit Failed', e instanceof Error ? e.message : 'Could not apply edit.')
    }
  }

  function handleOptions() {
    if (currentAsset === null) return
    const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' | 'default' }> = []

    // Editing actions (photos only — skip for videos)
    buttons.push({
      text: 'Rotate 90°',
      onPress: () => { void applyEdit([{ rotate: 90 }]) },
    })
    buttons.push({
      text: 'Flip Horizontal',
      onPress: () => { void applyEdit([{ flip: FlipType.Horizontal }]) },
    })
    buttons.push({
      text: 'Flip Vertical',
      onPress: () => { void applyEdit([{ flip: FlipType.Vertical }]) },
    })

    if (context === 'album' && contextId !== undefined) {
      buttons.push({
        text: 'Set as Album Cover',
        onPress: () => { void updateAlbumCover(contextId, currentAssetId) },
      })
      buttons.push({
        text: 'Remove from Album',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Remove from Album', 'Remove this photo from the album?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => {
                void removeAssetsFromAlbum(contextId, [currentAssetId]).then(() => { router.back() })
              },
            },
          ])
        },
      })
    }

    if (currentDate !== null) {
      buttons.push({ text: currentDate })
    }

    buttons.push({ text: 'Cancel', style: 'cancel' })
    Alert.alert('Options', undefined, buttons)
  }

  function handleDelete() {
    if (currentAsset === null) return
    const assetId = currentAsset.id
    hapticWarning()
    void useTrashStore.getState().moveToTrash(assetId).then(() => {
      removeAssets([assetId])
      router.back()
      showToast('Photo moved to Trash', () => {
        void useTrashStore.getState().restoreFromTrash(assetId)
      })
    })
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
            scrollEnabled={!isZoomed}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={getItemLayout}
            onViewableItemsChanged={onViewableItemsChanged.current}
            viewabilityConfig={viewabilityConfig.current}
            windowSize={3}
            maxToRenderPerBatch={3}
            removeClippedSubviews={false}
            extraData={overlaysVisible}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Header overlay */}
        <Animated.View
          style={[styles.header, { opacity: overlayOpacity }]}
          pointerEvents={overlaysVisible ? 'box-none' : 'none'}
        >
          <GlassView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={styles.headerButton} onPress={() => { router.back() }} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color="#ffffff" />
          </Pressable>
          <Pressable
            style={styles.headerButton}
            onPress={handleOptions}
            hitSlop={12}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color="#ffffff" />
          </Pressable>
        </Animated.View>

        {/* Footer overlay */}
        <Animated.View
          style={[styles.footer, { opacity: overlayOpacity }]}
          pointerEvents={overlaysVisible ? 'box-none' : 'none'}
        >
          <GlassView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
          {currentDate !== null && (
            <Text style={styles.dateText}>{currentDate}</Text>
          )}
          <View style={styles.actions}>
            <ActionButton
              label="Share"
              icon="share-outline"
              onPress={() => { void handleShare() }}
              loading={isSharing}
              disabled={isSharing || currentAsset === null}
            />
            <ActionButton label="Album" icon="add-circle-outline" onPress={handleAddToAlbum} />
            <ActionButton
              label="Favorite"
              icon={isFavorited ? 'heart' : 'heart-outline'}
              tint={isFavorited ? '#FF3B30' : '#ffffff'}
              onPress={() => { void toggleFavorite(currentAssetId) }}
            />
            <ActionButton label="Delete" icon="trash-outline" onPress={handleDelete} tint="#FF453A" />
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Play pill (centre)
  playPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  playPillTime: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  // Bottom scrubber pill — sits above the footer overlay (~150px tall)
  videoBottom: {
    position: 'absolute',
    bottom: 160,
    left: 16,
    right: 16,
  },
  scrubberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  scrubberTime: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    minWidth: 32,
    textAlign: 'center',
  },
  scrubberTrack: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
  },
  scrubberBg: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  scrubberFill: {
    position: 'absolute',
    height: 3,
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  scrubberThumb: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#ffffff',
    marginLeft: -6,
    top: 7,
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
    overflow: 'hidden',
  },
  headerButton: {
    padding: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingTop: 16,
    paddingHorizontal: 16,
    overflow: 'hidden',
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
    color: 'rgba(255,255,255,0.5)',
  },
  backFallback: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  backFallbackText: {
    color: '#0A84FF',
    fontSize: 15,
  },
})
