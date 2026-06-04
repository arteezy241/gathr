/**
 * Clean-Up Dashboard
 *
 * Category backing status:
 *  ✅ dupes    — wired to duplicateStore / duplicateDetector.ts
 *  ❌ near     — TODO: needs perceptual-hash similarity detection (no backing code)
 *  ❌ blurry   — TODO: needs sharpness/blur scoring (Laplacian variance or ML)
 *  ❌ videos   — TODO: needs large-video scanner (expo-media-library can enumerate
 *                       videos + getMediaType/size, but threshold logic doesn't exist)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { Stack, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDuplicateStore } from '@/store/duplicateStore'
import { type DuplicateGroup } from '@/lib/duplicateDetector'
import { type MediaLibraryAsset as Asset } from '@/lib/mediaLibrary'

// ─── Tokens ───────────────────────────────────────────────────────────────────
const AC = '#A488BE'
const AC_BG = 'rgba(164,136,190,0.16)'
const FG = '#FFFFFF'
const FG2 = 'rgba(235,235,245,0.55)'
const FG3 = 'rgba(235,235,245,0.28)'
const RED = '#FF453A'
const RED_BG = 'rgba(255,69,58,0.18)'

const { width: SCREEN_W } = Dimensions.get('window')
const CARD_W = Math.min(320, SCREEN_W - 40)
const CARD_H = 310
const SWIPE_THRESHOLD = 90
const THUMB_W = 108
const THUMB_H = 148

// ─── Types ────────────────────────────────────────────────────────────────────
type CategoryIconType = 'copy' | 'similar' | 'blur' | 'video'

interface CleanCluster {
  id: string
  label: string
  meta: string
  assetIds: string[]
  onDelete: () => void
  onDismiss: () => void
}

interface CleanCategory {
  id: string
  label: string
  icon: CategoryIconType
  clusters: CleanCluster[]
}

type ScreenView = 'entry' | 'scanning' | 'results' | 'stack' | 'allClean'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMB(mb: number): string {
  if (mb >= 1000) return `${(mb / 1024).toFixed(1)} GB`
  return `${String(Math.round(mb))} MB`
}

function assetUri(id: string): string {
  return Platform.OS === 'ios' ? `ph://${id}` : id
}

function dupGroupToCluster(
  group: DuplicateGroup,
  deleteFromGroup: (id: string, assets: Asset[]) => Promise<void>,
  dismissGroup: (id: string) => void,
): CleanCluster {
  const assetsToDelete = group.assets.filter((_, i) => i !== group.suggestedKeepIndex)
  const count = group.assets.length
  return {
    id: group.id,
    label: `${String(count)} identical shot${count === 1 ? '' : 's'}`,
    meta: `Burst · ${String(count)} photos · keep 1`,
    assetIds: group.assets.slice(0, 3).map((a) => a.id),
    onDelete: () => { void deleteFromGroup(group.id, assetsToDelete) },
    onDismiss: () => { dismissGroup(group.id) },
  }
}

function scanLabelForProgress(pct: number): string {
  if (pct >= 90) return 'Almost done…'
  if (pct >= 70) return 'Analysing videos…'
  if (pct >= 50) return 'Detecting blur…'
  if (pct >= 15) return 'Finding duplicates…'
  return 'Scanning library…'
}

// ─── SVG components ───────────────────────────────────────────────────────────
function GathrMarkSvg({ size = 40, color = AC }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size * 0.72} viewBox="0 0 40 29" fill="none">
      <Path
        d="M3 3L20 24L37 3"
        stroke={color}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function ChevronRightSvg() {
  return (
    <Svg width={7} height={12} viewBox="0 0 7 12" fill="none">
      <Path d="M1 1l5 5-5 5" stroke={FG3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function BackArrowSvg() {
  return (
    <Svg width={10} height={17} viewBox="0 0 10 17" fill="none">
      <Path d="M9 1L1.5 8.5L9 16" stroke={FG} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

const CATEGORY_ICON: Record<CategoryIconType, { name: React.ComponentProps<typeof Ionicons>['name'] }> = {
  copy:    { name: 'copy-outline' },
  similar: { name: 'albums-outline' },
  blur:    { name: 'eye-off-outline' },
  video:   { name: 'videocam-outline' },
}

function CategoryIconSvg({ type }: { type: CategoryIconType }) {
  return <Ionicons name={CATEGORY_ICON[type].name} size={18} color={FG3} />
}

// ─── Entry state ──────────────────────────────────────────────────────────────
function EntryState({ onScan }: { onScan: () => void }) {
  return (
    <View style={en.container}>
      <View style={en.top}>
        <Text style={en.storageLabel}>Storage</Text>
        <Text style={en.storageHint}>Scan to discover recoverable space</Text>
      </View>

      <View style={en.mark}>
        <GathrMarkSvg size={80} color={FG} />
      </View>

      <View style={en.bottom}>
        <Pressable
          onPress={onScan}
          style={({ pressed }) => [en.btn, pressed && { opacity: 0.85 }]}
        >
          <Text style={en.btnText}>Scan for clutter</Text>
        </Pressable>
        <Text style={en.disclaimer}>Runs entirely on-device. Nothing leaves your phone.</Text>
      </View>
    </View>
  )
}

const en = StyleSheet.create({
  container: { flex: 1, padding: 28, paddingTop: 16 },
  top: { marginBottom: 'auto' as unknown as number, paddingTop: 16 },
  storageLabel: {
    color: FG3, fontSize: 12, fontWeight: '500',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },
  storageHint: { color: FG3, fontSize: 15, lineHeight: 22 },
  mark: { flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.12 },
  bottom: { marginTop: 'auto' as unknown as number },
  btn: {
    width: '100%', height: 54, borderRadius: 27,
    backgroundColor: AC, alignItems: 'center', justifyContent: 'center',
  },
  btnText: { color: FG, fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  disclaimer: { color: FG3, fontSize: 12, textAlign: 'center', marginTop: 12 },
})

// ─── Scanning state ───────────────────────────────────────────────────────────
function ScanningState({ progress }: { progress: number }) {
  const label = scanLabelForProgress(progress)
  return (
    <View style={sc2.container}>
      <View style={{ marginBottom: 32, opacity: 0.3 }}>
        <GathrMarkSvg size={44} color={FG} />
      </View>
      <Text style={sc2.label}>{label}</Text>
      <View style={sc2.track}>
        <View style={[sc2.fill, { width: `${String(Math.round(progress))}%` as `${number}%` }]} />
      </View>
    </View>
  )
}

const sc2 = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  label: { color: FG2, fontSize: 15, marginBottom: 28 },
  track: {
    width: '100%', height: 2, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 1, overflow: 'hidden',
  },
  fill: { height: 2, backgroundColor: AC, borderRadius: 1 },
})

// ─── Results state ────────────────────────────────────────────────────────────
interface ResultsStateProps {
  categories: CleanCategory[]
  reclaimedMB: number
  onSelectCat: (catId: string) => void
}

function ResultsState({ categories, reclaimedMB, onSelectCat }: ResultsStateProps) {
  const visible = categories.filter((c) => c.clusters.length > 0)

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      {/* Header */}
      <View style={rs.header}>
        {reclaimedMB > 0 ? (
          <>
            <Text style={rs.headerLabel}>Reclaimed</Text>
            <Text style={[rs.headerValue, { color: AC }]}>{fmtMB(reclaimedMB)}</Text>
          </>
        ) : (
          <>
            <Text style={rs.headerLabel}>Recoverable</Text>
            <Text style={rs.headerValue}>{String(visible.length)} categor{visible.length === 1 ? 'y' : 'ies'} found</Text>
          </>
        )}
      </View>

      {/* Category rows */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={rs.list} showsVerticalScrollIndicator={false}>
        {visible.map((cat, i) => (
          <Pressable
            key={cat.id}
            onPress={() => { onSelectCat(cat.id) }}
            style={({ pressed }) => [rs.row, pressed && rs.rowPressed, { marginBottom: i < visible.length - 1 ? 2 : 0 }]}
          >
            <View style={rs.iconWrap}>
              <CategoryIconSvg type={cat.icon} />
            </View>
            <View style={rs.rowBody}>
              <Text style={rs.rowLabel}>{cat.label}</Text>
              <Text style={rs.rowMeta}>{String(cat.clusters.length)} group{cat.clusters.length === 1 ? '' : 's'}</Text>
            </View>
            <View style={rs.rowRight}>
              <Text style={rs.rowCount}>{String(cat.clusters.length)}</Text>
              <Text style={rs.rowCountSub}>clusters</Text>
            </View>
            <ChevronRightSvg />
          </Pressable>
        ))}

        {visible.length === 0 && (
          <View style={rs.noResults}>
            <Text style={rs.noResultsText}>No issues found</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const rs = StyleSheet.create({
  header: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 24 },
  headerLabel: {
    color: FG3, fontSize: 12, fontWeight: '500',
    letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 4,
  },
  headerValue: { color: FG, fontSize: 36, fontWeight: '700', letterSpacing: -1 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 14,
    backgroundColor: '#0C0C0E', borderRadius: 14,
  },
  rowPressed: { opacity: 0.75 },
  iconWrap: { marginRight: 14, opacity: 0.7 },
  rowBody: { flex: 1 },
  rowLabel: { color: FG, fontSize: 15, fontWeight: '500', marginBottom: 3 },
  rowMeta: { color: FG3, fontSize: 13 },
  rowRight: { alignItems: 'flex-end', marginRight: 12 },
  rowCount: { color: FG, fontSize: 15, fontWeight: '600' },
  rowCountSub: { color: FG3, fontSize: 11 },
  noResults: { paddingVertical: 40, alignItems: 'center' },
  noResultsText: { color: FG3, fontSize: 15 },
})

// ─── Swipe card ───────────────────────────────────────────────────────────────
interface SwipeCardProps {
  cluster: CleanCluster
  stackIndex: number
  onSwipe: (dir: 'trash' | 'keep') => void
}

function SwipeCard({ cluster, stackIndex, onSwipe }: SwipeCardProps) {
  const pan = useRef(new Animated.Value(0)).current
  const isTopRef = useRef(stackIndex === 0)
  isTopRef.current = stackIndex === 0

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isTopRef.current,
      onMoveShouldSetPanResponder: () => isTopRef.current,
      onPanResponderMove: (_, gesture) => {
        pan.setValue(gesture.dx)
      },
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) > SWIPE_THRESHOLD) {
          const dir: 'keep' | 'trash' = gesture.dx > 0 ? 'keep' : 'trash'
          Animated.timing(pan, {
            toValue: gesture.dx > 0 ? SCREEN_W + 100 : -(SCREEN_W + 100),
            duration: 210,
            useNativeDriver: true,
          }).start(() => { onSwipe(dir) })
        } else {
          Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start()
        }
      },
    }),
  ).current

  const rotation = pan.interpolate({
    inputRange: [-200, 200],
    outputRange: ['-18deg', '18deg'],
    extrapolate: 'clamp',
  })
  const trashOpacity = pan.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })
  const keepOpacity = pan.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })

  const isTop = stackIndex === 0
  const scale = 1 - stackIndex * 0.04
  const yOffset = stackIndex * 14

  const thumbs = cluster.assetIds.slice(0, 3)
  const fanAngles = thumbs.length === 1 ? [0] : thumbs.length === 2 ? [-5, 3] : [-7, -1, 4]
  const fanX = thumbs.length === 1 ? [0] : thumbs.length === 2 ? [-16, 16] : [-24, 0, 24]

  const cardLeft = (SCREEN_W - CARD_W) / 2

  return (
    <View
      style={[
        swc.outer,
        { left: cardLeft, transform: [{ scale }, { translateY: yOffset }], zIndex: 10 - stackIndex },
      ]}
    >
      {isTop ? (
        <Animated.View
          {...panResponder.panHandlers}
          style={{ transform: [{ translateX: pan }, { rotate: rotation as unknown as string }] }}
        >
          <CardFace
            cluster={cluster}
            thumbs={thumbs}
            fanAngles={fanAngles}
            fanX={fanX}
            trashOpacity={trashOpacity}
            keepOpacity={keepOpacity}
          />
        </Animated.View>
      ) : (
        <CardFace
          cluster={cluster}
          thumbs={thumbs}
          fanAngles={fanAngles}
          fanX={fanX}
          trashOpacity={new Animated.Value(0)}
          keepOpacity={new Animated.Value(0)}
        />
      )}
    </View>
  )
}

interface CardFaceProps {
  cluster: CleanCluster
  thumbs: string[]
  fanAngles: number[]
  fanX: number[]
  trashOpacity: Animated.AnimatedInterpolation<number> | Animated.Value
  keepOpacity: Animated.AnimatedInterpolation<number> | Animated.Value
}

function CardFace({ cluster, thumbs, fanAngles, fanX, trashOpacity, keepOpacity }: CardFaceProps) {
  return (
    <View style={swc.card}>
      {/* Thumbnail fan area */}
      <View style={swc.thumbArea}>
        {thumbs.map((assetId, i) => (
          <View
            key={assetId}
            style={[
              swc.thumb,
              {
                left: CARD_W / 2 - THUMB_W / 2 + (fanX[i] ?? 0),
                top: 26,
                transform: [{ rotate: `${String(fanAngles[i] ?? 0)}deg` }],
                zIndex: i + 1,
              },
            ]}
          >
            <Image
              source={{ uri: assetUri(assetId) }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              recyclingKey={assetId}
              transition={120}
            />
          </View>
        ))}

        {/* Directional overlays */}
        <Animated.View style={[swc.overlay, swc.overlayTrash, { opacity: trashOpacity }]} pointerEvents="none">
          <Ionicons name="trash-outline" size={44} color={RED} />
        </Animated.View>
        <Animated.View style={[swc.overlay, swc.overlayKeep, { opacity: keepOpacity }]} pointerEvents="none">
          <Ionicons name="checkmark-circle-outline" size={44} color={FG2} />
        </Animated.View>
      </View>

      {/* Card body */}
      <View style={swc.body}>
        <Text style={swc.bodyLabel}>{cluster.label}</Text>
        <Text style={swc.bodyMeta}>{cluster.meta}</Text>
      </View>
    </View>
  )
}

const swc = StyleSheet.create({
  outer: {
    position: 'absolute',
    width: CARD_W,
    top: 10,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: '#111114',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  thumbArea: {
    height: 188,
    position: 'relative',
    overflow: 'hidden',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#0A0A0C',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1e',
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  overlayTrash: { backgroundColor: RED_BG },
  overlayKeep: { backgroundColor: 'rgba(255,255,255,0.05)' },
  body: { padding: 14, paddingHorizontal: 18 },
  bodyLabel: { color: FG, fontSize: 15, fontWeight: '600', marginBottom: 4, letterSpacing: -0.1 },
  bodyMeta: { color: FG3, fontSize: 13 },
})

// ─── Card stack view (per-category) ──────────────────────────────────────────
interface CardStackViewProps {
  category: CleanCategory
  onBack: () => void
  onReclaim: () => void
}

function CardStackView({ category, onBack, onReclaim }: CardStackViewProps) {
  const [clusters, setClusters] = useState<CleanCluster[]>([...category.clusters])
  const [done, setDone] = useState(false)
  const [trashedCount, setTrashedCount] = useState(0)

  const handleSwipe = useCallback((dir: 'trash' | 'keep', cluster: CleanCluster) => {
    if (dir === 'trash') {
      cluster.onDelete()
      setTrashedCount((n) => n + 1)
      onReclaim()
    } else {
      cluster.onDismiss()
    }
    setClusters((prev) => {
      const next = prev.filter((c) => c.id !== cluster.id)
      if (next.length === 0) setTimeout(() => { setDone(true) }, 300)
      return next
    })
  }, [onReclaim])

  if (done) {
    return (
      <View style={{ flex: 1 }}>
        <View style={csv.topNav}>
          <Pressable onPress={onBack} style={csv.backBtn} hitSlop={12}>
            <BackArrowSvg />
            <Text style={csv.backLabel}>Done</Text>
          </Pressable>
        </View>
        <View style={csv.doneContainer}>
          <View style={{ marginBottom: 20 }}>
            <GathrMarkSvg size={36} />
          </View>
          <Text style={csv.doneTitle}>Category cleared</Text>
          {trashedCount > 0 && (
            <Text style={csv.doneSub}>{String(trashedCount)} group{trashedCount === 1 ? '' : 's'} sent to trash</Text>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={csv.topNav}>
        <Pressable onPress={onBack} style={csv.backBtn} hitSlop={12}>
          <BackArrowSvg />
          <Text style={csv.backLabel}>{category.label}</Text>
        </Pressable>
        <Text style={csv.remaining}>{String(clusters.length)} left</Text>
      </View>

      {/* Card stack */}
      <View style={csv.stackArea}>
        {clusters.slice(0, 3).map((cl, i) => (
          <SwipeCard
            key={cl.id}
            cluster={cl}
            stackIndex={i}
            onSwipe={(dir) => { handleSwipe(dir, cl) }}
          />
        ))}
      </View>

      {/* Direction hints */}
      <View style={csv.hints}>
        <View style={csv.hintItem}>
          <Ionicons name="trash-outline" size={20} color={RED} />
          <Text style={[csv.hintText, { color: RED }]}>Trash</Text>
        </View>
        <Text style={csv.swipeHint}>← swipe →</Text>
        <View style={csv.hintItem}>
          <Ionicons name="checkmark-circle-outline" size={20} color={FG2} style={{ opacity: 0.6 }} />
          <Text style={csv.hintText}>Keep</Text>
        </View>
      </View>
    </View>
  )
}

const csv = StyleSheet.create({
  topNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 0,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  backLabel: { color: FG2, fontSize: 15 },
  remaining: { color: FG3, fontSize: 14 },
  stackArea: {
    flex: 1, position: 'relative', overflow: 'hidden',
    alignItems: 'center', paddingTop: 10,
  },
  hints: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 36, paddingBottom: 28,
  },
  hintItem: { alignItems: 'center', gap: 6 },
  hintText: { color: FG3, fontSize: 11, fontWeight: '400' },
  swipeHint: { color: FG3, fontSize: 12, alignSelf: 'center', opacity: 0.5 },
  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  doneTitle: { color: FG, fontSize: 17, fontWeight: '600', marginBottom: 8 },
  doneSub: { color: FG3, fontSize: 14 },
})

// ─── All-clean state ──────────────────────────────────────────────────────────
function AllCleanState({ reclaimedCount }: { reclaimedCount: number }) {
  return (
    <View style={ac.container}>
      <View style={{ marginBottom: 24, opacity: 0.5 }}>
        <GathrMarkSvg size={48} />
      </View>
      <Text style={ac.title}>Your library is clean.</Text>
      <Text style={ac.sub}>No duplicates or large files found.</Text>
      {reclaimedCount > 0 && (
        <View style={ac.pill}>
          <Text style={ac.pillText}>
            Cleaned up{' '}
            <Text style={{ color: AC, fontWeight: '600' }}>{String(reclaimedCount)} group{reclaimedCount === 1 ? '' : 's'}</Text>
          </Text>
        </View>
      )}
    </View>
  )
}

const ac = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  title: { color: FG, fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginBottom: 8 },
  sub: { color: FG3, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  pill: {
    marginTop: 28, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: AC_BG, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(164,136,190,0.2)',
  },
  pillText: { color: FG2, fontSize: 14 },
})

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CleanUpScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { groups, isScanning, scanProgress, scannedAt, scan, deleteFromGroup, dismissGroup } =
    useDuplicateStore()

  const [view, setView] = useState<ScreenView>('entry')
  const [activeCatId, setActiveCatId] = useState<string | null>(null)
  const [reclaimedCount, setReclaimedCount] = useState(0)

  // Watch for scan completion
  useEffect(() => {
    if (view === 'scanning' && !isScanning && scannedAt !== null) {
      setView('results')
    }
  }, [view, isScanning, scannedAt])

  function handleScan() {
    setView('scanning')
    void scan()
  }

  function handleSelectCat(catId: string) {
    setActiveCatId(catId)
    setView('stack')
  }

  function handleBackFromStack() {
    // Check if all categories are now empty
    const allEmpty = categories.every((c) => c.clusters.length === 0)
    setView(allEmpty ? 'allClean' : 'results')
    setActiveCatId(null)
  }

  // ── Build categories from store data ────────────────────────────────────────
  const categories = useMemo<CleanCategory[]>(() => {
    const dupClusters = groups.map((g) =>
      dupGroupToCluster(g, deleteFromGroup, dismissGroup),
    )

    return [
      {
        id: 'dupes',
        label: 'Duplicates',
        icon: 'copy' as const,
        clusters: dupClusters,
      },
      // TODO: Near-duplicates — wire to perceptual-hash similarity detection
      // {
      //   id: 'near',
      //   label: 'Near-duplicates',
      //   icon: 'similar',
      //   clusters: [],  // TODO: nearDuplicateStore not implemented
      // },

      // TODO: Blurry shots — wire to sharpness/blur scorer (Laplacian variance or ML)
      // {
      //   id: 'blurry',
      //   label: 'Blurry shots',
      //   icon: 'blur',
      //   clusters: [],  // TODO: blurDetector not implemented
      // },

      // TODO: Large videos — enumerate via expo-media-library getAssetsAsync({ mediaType: 'video' })
      //       sort by fileSize desc, threshold at e.g. 100 MB. No store/detector exists yet.
      // {
      //   id: 'videos',
      //   label: 'Large videos',
      //   icon: 'video',
      //   clusters: [],  // TODO: largeVideoStore not implemented
      // },
    ]
  }, [groups, deleteFromGroup, dismissGroup])

  const activeCategory = categories.find((c) => c.id === activeCatId) ?? null

  const showTitle = view === 'entry' || view === 'results' || view === 'allClean'

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[ms.screen, { paddingTop: insets.top }]}>
        {/* Top nav */}
        {showTitle && (
          <View style={ms.nav}>
            <Pressable onPress={() => { router.back() }} style={ms.navBack} hitSlop={12}>
              <BackArrowSvg />
            </Pressable>
            <Text style={ms.navTitle}>Clean Up</Text>
            <View style={{ width: 32 }} />
          </View>
        )}

        {view === 'entry' && <EntryState onScan={handleScan} />}
        {view === 'scanning' && <ScanningState progress={scanProgress} />}
        {view === 'results' && (
          <ResultsState
            categories={categories}
            reclaimedMB={0}
            onSelectCat={handleSelectCat}
          />
        )}
        {view === 'stack' && activeCategory !== null && (
          <CardStackView
            category={activeCategory}
            onBack={handleBackFromStack}
            onReclaim={() => { setReclaimedCount((n) => n + 1) }}
          />
        )}
        {/* allClean — falls through when all other views are false */}
        {view !== 'entry' && view !== 'scanning' && view !== 'results' && view !== 'stack' && (
          <AllCleanState reclaimedCount={reclaimedCount} />
        )}
      </View>
    </>
  )
}

const ms = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  navBack: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  navTitle: {
    color: FG, fontSize: 22, fontWeight: '700', letterSpacing: -0.5,
  },
})
