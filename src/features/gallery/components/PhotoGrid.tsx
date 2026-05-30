import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'
import { impactMedium } from '@/lib/haptics'
import { useGallery } from '@/features/gallery/hooks/useGallery'
import { useSelectionStore } from '@/store/selectionStore'
import { PhotoThumb } from './PhotoThumb'

const NUM_COLUMNS = 3
const SCREEN_WIDTH = Dimensions.get('window').width
const THUMB_SIZE = Math.floor(SCREEN_WIDTH / NUM_COLUMNS)

function keyExtractor(item: MediaLibraryAsset): string {
  return item.id
}

export function PhotoGrid() {
  const router = useRouter()
  const { assets, isLoading, error, hasNextPage, loadMore } = useGallery()
  const { selectedIds, isSelecting, toggleSelect, selectAll, setLastSelected } =
    useSelectionStore()

  function handlePress(asset: MediaLibraryAsset) {
    if (isSelecting) {
      toggleSelect(asset.id)
      setLastSelected(asset.id)
    } else {
      router.push(`/photo/${asset.id}`)
    }
  }

  function handleLongPress(asset: MediaLibraryAsset) {
    void impactMedium()
    if (!isSelecting) {
      // Enter selection mode by selecting all with just this one asset to seed state,
      // then clear and select only the long-pressed asset
      selectAll([asset.id])
    } else {
      toggleSelect(asset.id)
    }
    setLastSelected(asset.id)
  }

  function handleEndReached() {
    if (hasNextPage) {
      void loadMore()
    }
  }

  function renderItem({ item }: ListRenderItemInfo<MediaLibraryAsset>) {
    return (
      <PhotoThumb
        asset={item}
        isSelected={selectedIds.has(item.id)}
        onPress={() => { handlePress(item) }}
        onLongPress={() => { handleLongPress(item) }}
      />
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
      data={assets}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={NUM_COLUMNS}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No photos found</Text>
        </View>
      }
      ListFooterComponent={
        isLoading && assets.length > 0 ? <ActivityIndicator style={styles.footer} /> : null
      }
      extraData={selectedIds}
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
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
})
