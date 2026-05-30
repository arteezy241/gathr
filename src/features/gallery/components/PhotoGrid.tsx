import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'
import { groupAssetsByDate } from '@/lib/dateUtils'
import { impactMedium } from '@/lib/haptics'
import { useGallery } from '@/features/gallery/hooks/useGallery'
import { useSelectionStore } from '@/store/selectionStore'
import { DateSectionHeader } from './DateSectionHeader'
import { PhotoThumb } from './PhotoThumb'

const NUM_COLUMNS = 3
const SCREEN_WIDTH = Dimensions.get('window').width
const THUMB_SIZE = Math.floor(SCREEN_WIDTH / NUM_COLUMNS)

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

export function PhotoGrid() {
  const router = useRouter()
  const { assets, isLoading, error, hasNextPage, loadMore } = useGallery()
  const { selectedIds, isSelecting, selectAll } = useSelectionStore()

  const [listData, setListData] = useState<ListItem[]>([])

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
    return () => {
      cancelled = true
    }
  }, [assets])

  const selectedIdsSnapshot = useMemo(() => selectedIds, [selectedIds])
  const allAssetIds = useMemo(() => assets.map((a) => a.id), [assets])

  function handlePress(asset: MediaLibraryAsset) {
    router.push(`/photo/${asset.id}`)
  }

  function handleLongPress(asset: MediaLibraryAsset) {
    void impactMedium()
    if (!isSelecting) {
      selectAll([asset.id])
    }
  }

  function handleEndReached() {
    if (hasNextPage) {
      void loadMore()
    }
  }

  function renderItem({ item }: ListRenderItemInfo<ListItem>) {
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
            onLongPress={() => { handleLongPress(asset) }}
          />
        ))}
        {item.assets.length < NUM_COLUMNS &&
          Array.from({ length: NUM_COLUMNS - item.assets.length }).map((_, i) => (
            <View key={`empty-${String(i)}`} style={styles.thumbPlaceholder} />
          ))}
      </View>
    )
  }

  if (isLoading && assets.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (error !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  return (
    <FlashList
      data={listData}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      numColumns={1}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        isLoading ? null : (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No photos found</Text>
          </View>
        )
      }
      ListFooterComponent={
        isLoading && assets.length > 0 ? <ActivityIndicator style={styles.footer} /> : null
      }
      extraData={selectedIdsSnapshot}
    />
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  row: {
    flexDirection: 'row',
  },
  thumbPlaceholder: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 16,
  },
})
