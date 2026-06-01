import { type ReactElement, useCallback, useEffect, useRef, useMemo, useState } from 'react'
import { ActivityIndicator, PanResponder, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'
import { groupAssetsByDate } from '@/lib/dateUtils'
import { useGallery } from '@/features/gallery/hooks/useGallery'
import { useSelectionStore } from '@/store/selectionStore'
import { Skeleton } from '@/components/ui/Skeleton'
import { useTheme } from '@/lib/themeContext'
import { hapticToggle } from '@/lib/haptics'
import { DateSectionHeader } from './DateSectionHeader'
import { PhotoThumb, THUMB_SIZE } from './PhotoThumb'

const NUM_COLUMNS = 3
const SKELETON_COUNT = 12
const ROW_HEIGHT = THUMB_SIZE + 2   // photo row: thumb + 2px gap
const HEADER_HEIGHT = 36            // date header approx height

interface HeaderItem {
  type: 'header'
  date: string
  label: string
  assetIds: string[]
}

interface PhotoRowItem {
  type: 'photo'
  assets: MediaLibraryAsset[]
  rowIndex: number
}

type ListItem = HeaderItem | PhotoRowItem

function keyExtractor(item: ListItem): string {
  if (item.type === 'header') return `header-${item.date}`
  const firstId = item.assets[0]?.id ?? String(item.rowIndex)
  return `row-${firstId}`
}

function getItemType(item: ListItem): string {
  return item.type
}

interface Props {
  listHeader?: ReactElement
  contentBottomPad?: number
  emptyComponent?: ReactElement
}

export function PhotoGrid({ listHeader, contentBottomPad, emptyComponent }: Props) {
  const router = useRouter()
  const { colors } = useTheme()
  const { assets, isLoading, error, hasNextPage, loadMore } = useGallery()
  const { selectedIds, isSelecting, toggleSelect, setLastSelected } = useSelectionStore()

  const [listData, setListData] = useState<ListItem[]>([])

  // ── Drag-to-select ───────────────────────────────────────────────────────
  const isSelectingRef = useRef(isSelecting)
  const selectedIdsRef = useRef(selectedIds)
  const listDataRef = useRef<ListItem[]>([])
  const scrollOffsetRef = useRef(0)
  const listTopRef = useRef(0)
  const listHeaderHeightRef = useRef(0)
  const dragModeRef = useRef<'select' | 'deselect'>('select')
  const draggedRef = useRef(new Set<string>())

  useEffect(() => { isSelectingRef.current = isSelecting }, [isSelecting])
  useEffect(() => { selectedIdsRef.current = selectedIds }, [selectedIds])
  useEffect(() => { listDataRef.current = listData }, [listData])

  function getAssetAt(pageX: number, pageY: number): MediaLibraryAsset | null {
    // relY = position within the FlashList scroll content (0 = top of content)
    const relY = pageY - listTopRef.current + scrollOffsetRef.current
    // listData items start after the ListHeaderComponent
    const itemRelY = relY - listHeaderHeightRef.current
    if (itemRelY < 0) return null
    let cumY = 0
    for (const item of listDataRef.current) {
      const h = item.type === 'header' ? HEADER_HEIGHT : ROW_HEIGHT
      if (itemRelY < cumY + h) {
        if (item.type !== 'photo') return null
        const col = Math.floor(pageX / ((THUMB_SIZE + 2)))
        if (col < 0 || col >= NUM_COLUMNS) return null
        return item.assets[col] ?? null
      }
      cumY += h
    }
    return null
  }

  const panResponder = useRef(PanResponder.create({
    // Only activate when already in selection mode — long-press fires first unimpeded
    onMoveShouldSetPanResponder: () => isSelectingRef.current,
    onPanResponderGrant: (e) => {
      draggedRef.current = new Set()
      const asset = getAssetAt(e.nativeEvent.pageX, e.nativeEvent.pageY)
      if (!asset) return
      dragModeRef.current = selectedIdsRef.current.has(asset.id) ? 'deselect' : 'select'
      // toggle the first item touched
      if (!draggedRef.current.has(asset.id)) {
        draggedRef.current.add(asset.id)
        useSelectionStore.getState().toggleSelect(asset.id)
        useSelectionStore.getState().setLastSelected(asset.id)
        hapticToggle()
      }
    },
    onPanResponderMove: (e) => {
      const asset = getAssetAt(e.nativeEvent.pageX, e.nativeEvent.pageY)
      if (!asset || draggedRef.current.has(asset.id)) return
      const alreadySelected = selectedIdsRef.current.has(asset.id)
      if (dragModeRef.current === 'select' && !alreadySelected) {
        draggedRef.current.add(asset.id)
        useSelectionStore.getState().toggleSelect(asset.id)
        useSelectionStore.getState().setLastSelected(asset.id)
        hapticToggle()
      } else if (dragModeRef.current === 'deselect' && alreadySelected) {
        draggedRef.current.add(asset.id)
        useSelectionStore.getState().toggleSelect(asset.id)
        useSelectionStore.getState().setLastSelected(asset.id)
        hapticToggle()
      }
    },
  })).current

  useEffect(() => {
    if (assets.length === 0) {
      setListData([])
      return
    }
    let cancelled = false
    void groupAssetsByDate(assets).then((groups) => {
      if (cancelled) return
      const flat: ListItem[] = []
      for (const group of groups) {
        flat.push({
          type: 'header',
          date: group.date,
          label: group.label,
          assetIds: group.assets.map((a) => a.id),
        })
        for (let i = 0; i < group.assets.length; i += NUM_COLUMNS) {
          flat.push({
            type: 'photo',
            assets: group.assets.slice(i, i + NUM_COLUMNS),
            rowIndex: i / NUM_COLUMNS,
          })
        }
      }
      setListData(flat)
    })
    return () => { cancelled = true }
  }, [assets])

  const selectedIdsSnapshot = useMemo(() => selectedIds, [selectedIds])
  const allAssetIds = useMemo(() => assets.map((a) => a.id), [assets])

  const handlePress = useCallback((asset: MediaLibraryAsset) => {
    if (isSelecting) {
      toggleSelect(asset.id)
      setLastSelected(asset.id)
    } else {
      router.push({ pathname: '/photo/[id]', params: { id: asset.id, context: 'gallery' } })
    }
  }, [isSelecting, toggleSelect, setLastSelected, router])

  const handleEndReached = useCallback(() => {
    if (hasNextPage) void loadMore()
  }, [hasNextPage, loadMore])

  const renderItem = useCallback(({ item }: ListRenderItemInfo<ListItem>) => {
    if (item.type === 'header') {
      const isAllSelected =
        item.assetIds.length > 0 && item.assetIds.every((id) => selectedIdsSnapshot.has(id))
      const isPartiallySelected =
        !isAllSelected && item.assetIds.some((id) => selectedIdsSnapshot.has(id))
      return (
        <DateSectionHeader
          label={item.label}
          date={item.date}
          assetIds={item.assetIds}
          isAllSelected={isAllSelected}
          isPartiallySelected={isPartiallySelected}
        />
      )
    }

    return (
      <View style={styles.row}>
        {item.assets.map((asset) => (
          <PhotoThumb
            key={asset.id}
            asset={asset}
            isSelected={selectedIdsSnapshot.has(asset.id)}
            allAssetIds={allAssetIds}
            onPress={() => { handlePress(asset) }}
            onLongPress={() => {}}
          />
        ))}
        {item.assets.length < NUM_COLUMNS &&
          Array.from({ length: NUM_COLUMNS - item.assets.length }).map((_, i) => (
            <View key={`empty-${String(i)}`} style={styles.thumbPlaceholder} />
          ))}
      </View>
    )
  }, [selectedIdsSnapshot, allAssetIds, handlePress])

  if (isLoading && assets.length === 0) {
    const skeletonRows = Array.from({ length: Math.ceil(SKELETON_COUNT / NUM_COLUMNS) })
    return (
      <View style={styles.skeletonGrid}>
        {skeletonRows.map((_, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {Array.from({ length: NUM_COLUMNS }).map((__, colIndex) => (
              <Skeleton key={colIndex} width={THUMB_SIZE} height={THUMB_SIZE} />
            ))}
          </View>
        ))}
      </View>
    )
  }

  if (error !== null) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.accentRed, textAlign: 'center' }}>{error}</Text>
      </View>
    )
  }

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(e) => {
        e.target.measure((_x, _y, _w, _h, _px, py) => { listTopRef.current = py })
      }}
      {...(isSelecting ? panResponder.panHandlers : {})}
    >
      <FlashList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        numColumns={1}
        ListHeaderComponent={
          listHeader !== undefined ? (
            <View onLayout={(e) => { listHeaderHeightRef.current = e.nativeEvent.layout.height }}>
              {listHeader}
            </View>
          ) : undefined
        }
        contentContainerStyle={contentBottomPad !== undefined ? { paddingBottom: contentBottomPad } : undefined}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y }}
        scrollEventThrottle={16}
        ListEmptyComponent={
          isLoading ? null : (emptyComponent ?? (
            <View style={styles.centered}>
              <Text style={{ color: colors.textTertiary, textAlign: 'center' }}>No photos found</Text>
            </View>
          ))
        }
        ListFooterComponent={
          isLoading && assets.length > 0
            ? <ActivityIndicator style={styles.footer} color={colors.accent} />
            : null
        }
        extraData={selectedIdsSnapshot}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  skeletonGrid: {
    gap: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  row: {
    flexDirection: 'row',
    columnGap: 2,
    marginBottom: 2,
  },
  thumbPlaceholder: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  footer: {
    paddingVertical: 16,
  },
})
