import { useEffect, useMemo, useState } from 'react'
import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { type StoredTrip, getTrip } from '@/lib/db'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'
import { useGalleryStore } from '@/store/galleryStore'
import { useSelectionStore } from '@/store/selectionStore'
import { PhotoThumb } from '@/features/gallery/components/PhotoThumb'
import { SelectionBar } from '@/features/gallery/components/SelectionBar'

const NUM_COLUMNS = 3
const SCREEN_WIDTH = Dimensions.get('window').width
const THUMB_SIZE = Math.floor(SCREEN_WIDTH / NUM_COLUMNS)
const HERO_HEIGHT = 250

interface PhotoRow {
  assets: MediaLibraryAsset[]
  rowIndex: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatShort(ts: number): string {
  const d = new Date(ts)
  const month = MONTHS[d.getMonth()] ?? ''
  return `${month} ${String(d.getDate())}`
}

function coverUri(assetId: string): string {
  return Platform.OS === 'ios' ? `ph://${assetId}` : assetId
}

function keyExtractor(item: PhotoRow): string {
  return `row-${item.assets[0]?.id ?? String(item.rowIndex)}`
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const allAssets = useGalleryStore((s) => s.assets)
  const { selectedIds, isSelecting, selectAll, setLastSelected } = useSelectionStore()

  const [trip, setTrip] = useState<StoredTrip | null>(null)
  const [isLoadingTrip, setIsLoadingTrip] = useState(true)
  const [tripAssets, setTripAssets] = useState<MediaLibraryAsset[]>([])

  useEffect(() => {
    let cancelled = false
    void getTrip(id).then((t) => {
      if (cancelled) return
      setTrip(t)
      setIsLoadingTrip(false)
    })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (trip === null || allAssets.length === 0) return
    let cancelled = false
    const start = trip.startDate
    const end = trip.endDate
    void Promise.all(
      allAssets.map(async (asset) => {
        const ms = await asset.getCreationTime()
        return { asset, ms }
      }),
    ).then((entries) => {
      if (cancelled) return
      const filtered = entries
        .filter((e): e is { asset: MediaLibraryAsset; ms: number } =>
          e.ms !== null && e.ms >= start && e.ms <= end,
        )
        .sort((a, b) => a.ms - b.ms)
        .map((e) => e.asset)
      setTripAssets(filtered)
    })
    return () => { cancelled = true }
  }, [trip, allAssets])

  const allAssetIds = useMemo(() => tripAssets.map((a) => a.id), [tripAssets])

  const rows = useMemo<PhotoRow[]>(() => {
    const result: PhotoRow[] = []
    for (let i = 0; i < tripAssets.length; i += NUM_COLUMNS) {
      result.push({ assets: tripAssets.slice(i, i + NUM_COLUMNS), rowIndex: i / NUM_COLUMNS })
    }
    return result
  }, [tripAssets])

  const screenTitle = trip?.label ?? 'Trip'

  function renderRow({ item }: ListRenderItemInfo<PhotoRow>) {
    return (
      <View style={styles.row}>
        {item.assets.map((asset) => (
          <PhotoThumb
            key={asset.id}
            asset={asset}
            isSelected={selectedIds.has(asset.id)}
            allAssetIds={allAssetIds}
            onPress={() => { router.push({ pathname: '/photo/[id]', params: { id: asset.id, context: 'trip', contextId: id } }) }}
            onLongPress={() => { selectAll([asset.id]); setLastSelected(asset.id) }}
          />
        ))}
        {item.assets.length < NUM_COLUMNS &&
          Array.from({ length: NUM_COLUMNS - item.assets.length }).map((_, i) => (
            <View key={`empty-${String(i)}`} style={styles.thumbPlaceholder} />
          ))}
      </View>
    )
  }

  function renderHeader() {
    if (trip === null) return null
    const dateRange = `${formatShort(trip.startDate)} – ${formatShort(trip.endDate)}`
    return (
      <View>
        <View style={styles.hero}>
          <Image
            source={{ uri: coverUri(trip.coverAssetId) }}
            style={styles.heroImage}
            contentFit="cover"
            recyclingKey={trip.coverAssetId}
          />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroSubtitle}>{trip.subtitle}</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {String(tripAssets.length)} {tripAssets.length === 1 ? 'photo' : 'photos'} · {dateRange}
          </Text>
        </View>
      </View>
    )
  }

  if (isLoadingTrip) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        <View style={styles.centered} />
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: screenTitle,
          headerBackTitle: 'Back',
        }}
      />
      <View style={styles.screen}>
        <FlashList
          data={rows}
          renderItem={renderRow}
          keyExtractor={keyExtractor}
          numColumns={1}
          ListHeaderComponent={renderHeader}
          extraData={selectedIds}
        />
        {isSelecting && <SelectionBar />}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
  },
  hero: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  metaRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  metaText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  row: {
    flexDirection: 'row',
  },
  thumbPlaceholder: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
})
