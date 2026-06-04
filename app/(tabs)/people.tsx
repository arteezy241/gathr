import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { usePeopleStore, type PersonCluster } from '@/store/peopleStore'
import { useTheme } from '@/lib/themeContext'
import { type ThemeColors } from '@/lib/theme'
import { hapticTap, hapticAction } from '@/lib/haptics'
import { PILL_HEIGHT, PILL_MARGIN_BOTTOM } from '@/components/ui/FloatingTabBar'

const SCREEN_WIDTH = Dimensions.get('window').width
const GRID_GAP = 2
const CARD_SIZE = Math.floor((SCREEN_WIDTH - GRID_GAP) / 2)

const AC = '#A488BE'

function assetUri(assetId: string): string {
  return Platform.OS === 'ios' ? `ph://${assetId}` : assetId
}

// ─── Gathr mark (chevron/arch shape) for empty state ─────────────────────────
function GathrMark({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.72} viewBox="0 0 20 14.4" fill="none">
      <Path
        d="M2 2L10 11L18 2"
        stroke={AC}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

// ─── Rescan dropdown menu ─────────────────────────────────────────────────────
interface RescanMenuProps {
  onClose: () => void
  onRescan: () => void
  onWipeRescan: () => void
}

function RescanMenu({ onClose, onRescan, onWipeRescan }: RescanMenuProps) {
  return (
    <View style={rm.panel}>
      <Pressable
        onPress={() => { onRescan(); onClose() }}
        style={({ pressed }) => [rm.item, pressed && rm.itemPressed]}
      >
        <Text style={rm.itemText}>Rescan library</Text>
      </Pressable>
      <View style={rm.divider} />
      <Pressable
        onPress={() => { onWipeRescan(); onClose() }}
        style={({ pressed }) => [rm.item, pressed && rm.itemPressed]}
      >
        <Text style={[rm.itemText, rm.itemDanger]}>Wipe &amp; rescan</Text>
      </Pressable>
    </View>
  )
}

const rm = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 38,
    right: 0,
    width: 188,
    backgroundColor: 'rgba(28,22,40,0.97)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
    zIndex: 200,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  itemPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  itemText: {
    color: '#FFFFFF',
    fontSize: 14,
    letterSpacing: 0.05,
  },
  itemDanger: {
    color: '#FF453A',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 10,
  },
})

// ─── People header ────────────────────────────────────────────────────────────
interface PeopleHeaderProps {
  count: number
  isScanning: boolean
  onRescan: () => void
  onWipeRescan: () => void
}

function PeopleHeader({ count, isScanning, onRescan, onWipeRescan }: PeopleHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <View style={hdr.row}>
      <Text style={hdr.title}>
        {count} {count === 1 ? 'person' : 'people'}
      </Text>
      <View style={{ position: 'relative' }}>
        <Pressable
          onPress={() => { setMenuOpen((v) => !v) }}
          style={({ pressed }) => [hdr.btn, (pressed || menuOpen) && hdr.btnActive]}
          disabled={isScanning}
          hitSlop={8}
        >
          {isScanning
            ? <ActivityIndicator size="small" color={AC} />
            : (
              <Svg width={19} height={19} viewBox="0 0 19 19" fill="none">
                <Path
                  d="M16.5 9.5A7 7 0 114.2 4.5"
                  stroke={menuOpen ? 'rgba(235,235,245,0.60)' : 'rgba(235,235,245,0.30)'}
                  strokeWidth="1.65"
                  strokeLinecap="round"
                />
                <Path
                  d="M4 2v3.2h3.2"
                  stroke={menuOpen ? 'rgba(235,235,245,0.60)' : 'rgba(235,235,245,0.30)'}
                  strokeWidth="1.65"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
        </Pressable>
        {menuOpen && (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => { setMenuOpen(false) }} />
            <RescanMenu
              onClose={() => { setMenuOpen(false) }}
              onRescan={onRescan}
              onWipeRescan={onWipeRescan}
            />
          </>
        )}
      </View>
    </View>
  )
}

const hdr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 10,
    flexShrink: 0,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
})

// ─── Scan banner ──────────────────────────────────────────────────────────────
interface ScanBannerProps {
  scanned: number
  total: number
  progress: number
}

function ScanBanner({ scanned, total, progress }: ScanBannerProps) {
  const pct = Math.min(100, progress)
  return (
    <View style={sb.container}>
      <View style={sb.row}>
        <ActivityIndicator size="small" color={AC} style={{ width: 13, height: 13 }} />
        <Text style={sb.text} numberOfLines={1}>
          {'Scanning '}
          <Text style={sb.textBold}>{scanned.toLocaleString()}</Text>
          {' / '}
          <Text style={sb.textDim}>{total > 0 ? total.toLocaleString() : '…'}</Text>
          {' photos'}
        </Text>
        <Text style={sb.pct}>{Math.round(pct)}%</Text>
      </View>
      <View style={sb.track}>
        <View style={[sb.fill, { width: `${String(pct)}%` as `${number}%` }]} />
      </View>
    </View>
  )
}

const sb = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(26,20,36,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(164,136,190,0.16)',
    flexShrink: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  text: {
    color: 'rgba(235,235,245,0.60)',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    letterSpacing: 0.05,
  },
  textBold: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  textDim: {
    color: 'rgba(235,235,245,0.30)',
  },
  pct: {
    color: 'rgba(235,235,245,0.30)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  track: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fill: {
    height: 2,
    backgroundColor: AC,
  },
})

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onScan }: { onScan: () => void }) {
  return (
    <View style={es.container}>
      <View style={{ marginBottom: 24, opacity: 0.75 }}>
        <GathrMark size={48} />
      </View>
      <Text style={es.title}>Discover the people{'\n'}in your photos</Text>
      <Pressable onPress={onScan} style={({ pressed }) => [es.btn, pressed && { opacity: 0.85 }]}>
        <Text style={es.btnText}>Scan Library</Text>
      </Pressable>
    </View>
  )
}

const es = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: -0.4,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 30,
  },
  btn: {
    backgroundColor: AC,
    borderRadius: 22,
    paddingHorizontal: 30,
    paddingVertical: 11,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.05,
  },
})

// ─── Person card ──────────────────────────────────────────────────────────────
interface PersonCardProps {
  cluster: PersonCluster
  index: number
  onPress: () => void
  onRename: (clusterId: string, name: string) => void
}

function PersonCard({ cluster, index, onPress, onRename }: PersonCardProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameText, setRenameText] = useState(cluster.name ?? '')
  const inputRef = useRef<TextInput>(null)

  const displayName = cluster.name ?? `Person ${String(index + 1)}`
  const isNamed = cluster.name !== null && cluster.name.length > 0

  function handleLongPress() {
    hapticTap()
    setRenameText(cluster.name ?? '')
    setIsRenaming(true)
    setTimeout(() => { inputRef.current?.focus() }, 50)
  }

  function submitRename() {
    const trimmed = renameText.trim()
    if (trimmed.length > 0) onRename(cluster.id, trimmed)
    setIsRenaming(false)
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      delayLongPress={400}
      style={pc.card}
    >
      <Image
        source={{ uri: assetUri(cluster.coverAssetId) }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        recyclingKey={cluster.coverAssetId}
        transition={200}
      />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.72)']}
        style={pc.scrim}
        pointerEvents="none"
      />

      <View style={pc.labelRow}>
        {isRenaming ? (
          <TextInput
            ref={inputRef}
            value={renameText}
            onChangeText={setRenameText}
            onSubmitEditing={submitRename}
            onBlur={submitRename}
            returnKeyType="done"
            autoCorrect={false}
            selectionColor={AC}
            style={pc.renameInput}
          />
        ) : (
          <Text
            style={[pc.name, !isNamed && pc.nameUnnamed]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
        )}
        <Text style={pc.count}>{String(cluster.photoCount)}</Text>
      </View>

      {isRenaming && <View style={pc.renameBorder} pointerEvents="none" />}
    </Pressable>
  )
}

const pc = StyleSheet.create({
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#1a1428',
  },
  scrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: CARD_SIZE * 0.56,
  },
  labelRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 9,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
    flex: 1,
    minWidth: 0,
  },
  nameUnnamed: {
    color: 'rgba(235,235,245,0.60)',
    fontWeight: '400',
  },
  count: {
    color: 'rgba(235,235,245,0.30)',
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 0.15,
    flexShrink: 0,
    paddingBottom: 1,
  },
  renameInput: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    padding: 0,
    paddingBottom: 3,
    borderBottomWidth: 1.5,
    borderBottomColor: AC,
  },
  renameBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(164,136,190,0.25)',
  },
})

// ─── People screen ────────────────────────────────────────────────────────────
interface PersonRow {
  left: PersonCluster
  right: PersonCluster | null
  leftIndex: number
}

export default function PeopleScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const router = useRouter()
  const {
    clusters,
    isScanning,
    scanProgress,
    scanScanned,
    scanTotal,
    lastScannedAt,
    startScan,
    wipeAndRescan,
    renamePerson,
    loadClusters,
  } = usePeopleStore()

  const bottomPad = insets.bottom + PILL_MARGIN_BOTTOM + PILL_HEIGHT + 8
  const styles = useMemo(() => makeStyles(colors, insets.top, bottomPad), [colors, insets.top, bottomPad])

  const hasNeverScanned = lastScannedAt === null && !isScanning

  useEffect(() => {
    void loadClusters()
  }, [loadClusters])

  const handleRescan = useCallback(() => {
    hapticAction()
    void startScan()
  }, [startScan])

  const handleWipeRescan = useCallback(() => {
    hapticAction()
    void wipeAndRescan()
  }, [wipeAndRescan])

  const handleRename = useCallback((id: string, name: string) => {
    void renamePerson(id, name)
  }, [renamePerson])

  // Build rows of 2
  const rows = useMemo<PersonRow[]>(() => {
    const result: PersonRow[] = []
    for (let i = 0; i < clusters.length; i += 2) {
      result.push({
        left: clusters[i] as PersonCluster,
        right: clusters[i + 1] ?? null,
        leftIndex: i,
      })
    }
    return result
  }, [clusters])

  const showResults = !hasNeverScanned && clusters.length > 0

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        {/* Header — only shown when there are results or scanning */}
        {(showResults || isScanning) && (
          <PeopleHeader
            count={clusters.length}
            isScanning={isScanning}
            onRescan={handleRescan}
            onWipeRescan={handleWipeRescan}
          />
        )}

        {/* Scan banner */}
        {isScanning && (
          <ScanBanner
            scanned={scanScanned}
            total={scanTotal}
            progress={scanProgress}
          />
        )}

        {/* Content */}
        {hasNeverScanned ? (
          <EmptyState onScan={() => { hapticAction(); void startScan() }} />
        ) : clusters.length === 0 && !isScanning ? (
          // No results after scan
          <View style={styles.noResults}>
            <View style={{ marginBottom: 24, opacity: 0.75 }}>
              <GathrMark size={48} />
            </View>
            <Text style={styles.noResultsTitle}>No people found</Text>
            <Text style={styles.noResultsBody}>
              No recognizable faces were found. Try scanning again with more photos.
            </Text>
            <Pressable
              onPress={() => { hapticAction(); void startScan() }}
              style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.scanBtnText}>Scan Again</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
          >
            {rows.map((row) => (
              <View key={row.left.id} style={styles.row}>
                <PersonCard
                  cluster={row.left}
                  index={row.leftIndex}
                  onPress={() => {
                    hapticTap()
                    router.push({ pathname: '/people/[id]', params: { id: row.left.id } })
                  }}
                  onRename={handleRename}
                />
                {row.right !== null ? (
                  <PersonCard
                    cluster={row.right}
                    index={row.leftIndex + 1}
                    onPress={() => {
                      hapticTap()
                      if (row.right !== null) {
                        router.push({ pathname: '/people/[id]', params: { id: row.right.id } })
                      }
                    }}
                    onRename={handleRename}
                  />
                ) : (
                  <View style={{ width: CARD_SIZE }} />
                )}
              </View>
            ))}
          </ScrollView>
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
    gridContent: {
      paddingBottom: bottomPad,
    },
    row: {
      flexDirection: 'row',
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    noResults: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingBottom: 80,
    },
    noResultsTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: '600',
      letterSpacing: -0.3,
      textAlign: 'center',
      marginBottom: 10,
    },
    noResultsBody: {
      color: colors.textTertiary,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 28,
    },
    scanBtn: {
      backgroundColor: AC,
      borderRadius: 22,
      paddingHorizontal: 30,
      paddingVertical: 11,
    },
    scanBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },
  })
}
