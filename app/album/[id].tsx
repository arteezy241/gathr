import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { FlashList, type FlashListRef, type ListRenderItemInfo } from '@shopify/flash-list'
import { type Album, getAlbum, getAlbumAssetIds, updateAlbumCover, addAssetsToAlbum } from '@/lib/db'
import { Asset, type MediaLibraryAsset } from '@/lib/mediaLibrary'
import { useSelectionStore } from '@/store/selectionStore'
import { useBiometricAuth } from '@/features/private-albums/hooks/useBiometricAuth'
import { PhotoThumb, THUMB_SIZE } from '@/features/gallery/components/PhotoThumb'
import { useTheme } from '@/lib/themeContext'
import { hapticToggle } from '@/lib/haptics'
import { radius, typography, type ThemeColors } from '@/lib/theme'
import { PhotoPickerModal } from '@/features/albums/components/PhotoPickerModal'
import { ScrollIndicator } from '@/components/ui/ScrollIndicator'

const NUM_COLUMNS = 3


// Android asset IDs are content URIs ending in a numeric media-store ID.
// Higher number = more recently added to the device library.
function numericId(assetId: string): number {
  const m = assetId.match(/(\d+)$/)
  return m !== null && m[1] !== undefined ? parseInt(m[1], 10) : 0
}

interface PhotoRow {
  assets: MediaLibraryAsset[]
  rowIndex: number
}

function keyExtractor(item: PhotoRow): string {
  return `row-${item.assets[0]?.id ?? String(item.rowIndex)}`
}

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { colors } = useTheme()
  const { selectedIds, isSelecting } = useSelectionStore()
  const { isAuthenticated, isAuthenticating, authenticate } = useBiometricAuth()

  const [album, setAlbum] = useState<Album | null>(null)
  const [albumAssets, setAlbumAssets] = useState<MediaLibraryAsset[]>([])
  const [albumAssetIds, setAlbumAssetIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [containerHeight, setContainerHeight] = useState(0)
  const [contentHeight, setContentHeight] = useState(0)
  const listRef = useRef<FlashListRef<PhotoRow> | null>(null)
  const scrollY = useRef(new Animated.Value(0)).current

  // ── Drag-to-select ──────────────────────────────────────────────────────
  const isSelectingRef = useRef(isSelecting)
  const selectedIdsRef = useRef(selectedIds)
  const rowsRef = useRef<PhotoRow[]>([])
  const scrollOffsetRef = useRef(0)
  const listTopRef = useRef(0)
  const listHeaderHeightRef = useRef(0)
  const dragModeRef = useRef<'select' | 'deselect'>('select')
  const draggedRef = useRef(new Set<string>())

  useEffect(() => { isSelectingRef.current = isSelecting }, [isSelecting])
  useEffect(() => { selectedIdsRef.current = selectedIds }, [selectedIds])

  const styles = useMemo(() => makeStyles(colors), [colors])

  function getAssetAt(pageX: number, pageY: number): MediaLibraryAsset | null {
    const relY = pageY - listTopRef.current + scrollOffsetRef.current - listHeaderHeightRef.current
    if (relY < 0) return null
    const rowIndex = Math.floor(relY / THUMB_SIZE)
    const row = rowsRef.current[rowIndex]
    if (row === undefined) return null
    const col = Math.floor(pageX / THUMB_SIZE)
    if (col < 0 || col >= NUM_COLUMNS) return null
    return row.assets[col] ?? null
  }

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: () => isSelectingRef.current,
    onPanResponderGrant: (e) => {
      draggedRef.current = new Set()
      const asset = getAssetAt(e.nativeEvent.pageX, e.nativeEvent.pageY)
      if (asset === null) return
      dragModeRef.current = selectedIdsRef.current.has(asset.id) ? 'deselect' : 'select'
      draggedRef.current.add(asset.id)
      useSelectionStore.getState().toggleSelect(asset.id)
      useSelectionStore.getState().setLastSelected(asset.id)
      hapticToggle()
    },
    onPanResponderMove: (e) => {
      const asset = getAssetAt(e.nativeEvent.pageX, e.nativeEvent.pageY)
      if (asset === null || draggedRef.current.has(asset.id)) return
      const alreadySelected = selectedIdsRef.current.has(asset.id)
      if (
        (dragModeRef.current === 'select' && !alreadySelected) ||
        (dragModeRef.current === 'deselect' && alreadySelected)
      ) {
        draggedRef.current.add(asset.id)
        useSelectionStore.getState().toggleSelect(asset.id)
        useSelectionStore.getState().setLastSelected(asset.id)
        hapticToggle()
      }
    },
  })).current

  useEffect(() => {
    let cancelled = false
    void Promise.all([getAlbum(id), getAlbumAssetIds(id)]).then(([a, ids]) => {
      if (cancelled) return
      const sorted = [...ids].sort((x, y) => numericId(y) - numericId(x))
      setAlbum(a)
      setAlbumAssetIds(sorted)
      setAlbumAssets(sorted.map((assetId) => new Asset(assetId)))
      setIsLoading(false)
      // Silently fix the cover to always show the newest photo
      const newestId = sorted[0]
      if (newestId !== undefined && newestId !== a?.coverAssetId) {
        void updateAlbumCover(id, newestId)
      }
    })
    return () => { cancelled = true }
  }, [id])

  const allAssetIds = useMemo(() => albumAssets.map((a) => a.id), [albumAssets])

  const rows = useMemo<PhotoRow[]>(() => {
    const result: PhotoRow[] = []
    for (let i = 0; i < albumAssets.length; i += NUM_COLUMNS) {
      result.push({ assets: albumAssets.slice(i, i + NUM_COLUMNS), rowIndex: i / NUM_COLUMNS })
    }
    return result
  }, [albumAssets])

  useEffect(() => { rowsRef.current = rows }, [rows])

  const currentAlbumAssetIds = useMemo(() => new Set(albumAssetIds), [albumAssetIds])

  async function handlePickerConfirm(newIds: string[]): Promise<void> {
    setPickerVisible(false)
    if (newIds.length === 0) return
    await addAssetsToAlbum(id, newIds)
    setAlbumAssetIds((prev) => {
      const merged = [...newIds, ...prev]
      // Highest numeric ID = most recently added; keep that as cover
      const newest = merged.sort((x, y) => numericId(y) - numericId(x))
      const newestId = newest[0]
      if (newestId !== undefined) {
        void updateAlbumCover(id, newestId)
        setAlbum((a) => a !== null ? { ...a, coverAssetId: newestId } : a)
      }
      return newest
    })
    setAlbumAssets((prev) => [...newIds.map((assetId) => new Asset(assetId)), ...prev])
  }

  function renderRow({ item }: ListRenderItemInfo<PhotoRow>) {
    return (
      <View style={styles.row}>
        {item.assets.map((asset) => (
          <PhotoThumb
            key={asset.id}
            asset={asset}
            isSelected={selectedIds.has(asset.id)}
            allAssetIds={allAssetIds}
            onPress={() => { router.push({ pathname: '/photo/[id]', params: { id: asset.id, context: 'album', contextId: id } }) }}
            onLongPress={() => { /* selection handled inside PhotoThumb */ }}
          />
        ))}
        {item.assets.length < NUM_COLUMNS &&
          Array.from({ length: NUM_COLUMNS - item.assets.length }).map((_, i) => (
            <View key={`empty-${String(i)}`} style={styles.thumbPlaceholder} />
          ))}
      </View>
    )
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        <View style={styles.centered} />
      </>
    )
  }

  const screenTitle = album?.name ?? 'Album'

  if (album?.isPrivate === true && !isAuthenticated) {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle }} />
        <View style={styles.centered}>
          <Text style={styles.lockEmoji}>🔒</Text>
          <Text style={styles.lockedTitle}>Private Album</Text>
          <Text style={styles.lockedBody}>Authenticate to view this album's contents.</Text>
          <Pressable
            style={[styles.unlockButton, isAuthenticating && styles.unlockButtonDisabled]}
            onPress={() => { void authenticate(`Unlock "${screenTitle}"`) }}
            disabled={isAuthenticating}
          >
            <Text style={styles.unlockButtonText}>
              {isAuthenticating ? 'Authenticating…' : 'Unlock with Biometrics'}
            </Text>
          </Pressable>
        </View>
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: screenTitle,
          headerRight: () => (
            <Pressable onPress={() => { setPickerVisible(true) }} hitSlop={8}>
              <Text style={styles.addPhotosButton}>Add Photos</Text>
            </Pressable>
          ),
        }}
      />
      <PhotoPickerModal
        visible={pickerVisible}
        excludeIds={currentAlbumAssetIds}
        onClose={() => { setPickerVisible(false) }}
        onConfirm={(ids) => { void handlePickerConfirm(ids) }}
      />
      {albumAssets.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No Photos</Text>
          <Text style={styles.emptyBody}>Add photos to this album using the button above.</Text>
        </View>
      ) : (
        <View
          style={styles.listContainer}
          onLayout={(e) => {
            setContainerHeight(e.nativeEvent.layout.height)
            e.target.measure((_x, _y, _w, _h, _px, py) => { listTopRef.current = py })
          }}
          {...(isSelecting ? panResponder.panHandlers : {})}
        >
          <FlashList
            ref={listRef}
            data={rows}
            renderItem={renderRow}
            keyExtractor={keyExtractor}
            extraData={selectedIds}
            onScroll={(e) => {
              scrollOffsetRef.current = e.nativeEvent.contentOffset.y
              scrollY.setValue(e.nativeEvent.contentOffset.y)
            }}
            onContentSizeChange={(_w, h) => { setContentHeight(h) }}
            scrollEventThrottle={16}
          />
          {containerHeight > 0 && contentHeight > containerHeight && (
            <ScrollIndicator
              scrollY={scrollY}
              contentHeight={contentHeight}
              viewHeight={containerHeight}
              onSeek={(offset) => {
                listRef.current?.scrollToOffset({ offset, animated: false })
              }}
            />
          )}
        </View>
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
      padding: 32,
      backgroundColor: colors.background,
    },
    listContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    row: {
      flexDirection: 'row',
      backgroundColor: colors.background,
    },
    thumbPlaceholder: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      backgroundColor: colors.background,
    },
    addPhotosButton: {
      fontSize: 16,
      color: colors.accent,
    },
    lockEmoji: {
      fontSize: 48,
      marginBottom: 16,
    },
    lockedTitle: {
      ...typography.title,
      fontSize: 20,
      color: colors.text,
      marginBottom: 8,
    },
    lockedBody: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 28,
    },
    unlockButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: radius.md,
    },
    unlockButtonDisabled: {
      backgroundColor: colors.border,
    },
    unlockButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    emptyTitle: {
      ...typography.title,
      fontSize: 20,
      color: colors.text,
      marginBottom: 8,
    },
    emptyBody: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  })
}
