import { useEffect, useMemo, useState } from 'react'
import { Alert, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { type Album, getAlbum, getAlbumAssetIds } from '@/lib/db'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'
import { useGalleryStore } from '@/store/galleryStore'
import { useSelectionStore } from '@/store/selectionStore'
import { useBiometricAuth } from '@/features/private-albums/hooks/useBiometricAuth'
import { PhotoThumb } from '@/features/gallery/components/PhotoThumb'

const NUM_COLUMNS = 3
const THUMB_SIZE = Math.floor(Dimensions.get('window').width / NUM_COLUMNS)

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
  const allAssets = useGalleryStore((s) => s.assets)
  const { selectedIds, selectAll, setLastSelected } = useSelectionStore()
  const { isAuthenticated, isAuthenticating, authenticate } = useBiometricAuth()

  const [album, setAlbum] = useState<Album | null>(null)
  const [albumAssetIds, setAlbumAssetIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void Promise.all([getAlbum(id), getAlbumAssetIds(id)]).then(([a, ids]) => {
      if (cancelled) return
      setAlbum(a)
      setAlbumAssetIds(ids)
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [id])

  const albumAssets = useMemo(() => {
    const idSet = new Set(albumAssetIds)
    return allAssets.filter((a) => idSet.has(a.id))
  }, [allAssets, albumAssetIds])

  const allAssetIds = useMemo(() => albumAssets.map((a) => a.id), [albumAssets])

  const rows = useMemo<PhotoRow[]>(() => {
    const result: PhotoRow[] = []
    for (let i = 0; i < albumAssets.length; i += NUM_COLUMNS) {
      result.push({ assets: albumAssets.slice(i, i + NUM_COLUMNS), rowIndex: i / NUM_COLUMNS })
    }
    return result
  }, [albumAssets])

  function handleAddPhotos() {
    Alert.alert('Coming Soon', 'Adding photos to albums from the gallery is coming in a future update.')
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
            <Pressable onPress={handleAddPhotos} hitSlop={8}>
              <Text style={styles.addPhotosButton}>Add Photos</Text>
            </Pressable>
          ),
        }}
      />
      {albumAssets.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No Photos</Text>
          <Text style={styles.emptyBody}>Add photos to this album using the button above.</Text>
        </View>
      ) : (
        <FlashList
          data={rows}
          renderItem={renderRow}
          keyExtractor={keyExtractor}
          extraData={selectedIds}
        />
      )}
    </>
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
  addPhotosButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  lockEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  lockedBody: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 28,
  },
  unlockButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  unlockButtonDisabled: {
    backgroundColor: '#A8A8AD',
  },
  unlockButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
  },
})
