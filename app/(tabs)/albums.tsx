import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { theme } from '@/lib/theme'
import { Skeleton } from '@/components/ui/Skeleton'
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { type Album, initDb } from '@/lib/db'
import { useAlbumStore } from '@/store/albumStore'
import { useBiometricAuth } from '@/features/private-albums/hooks/useBiometricAuth'
import { AlbumCard } from '@/features/albums/components/AlbumCard'
import { CreateAlbumSheet } from '@/features/albums/components/CreateAlbumSheet'

const ALBUM_CARD_SIZE = Math.floor((Dimensions.get('window').width - 3) / 2)
const SKELETON_ALBUM_COUNT = 4

interface AlbumRow {
  left: Album
  right: Album | null
  leftCount: number
  rightCount: number
}

export default function AlbumsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { albums, isLoading, loadAlbums } = useAlbumStore()
  const { authenticate } = useBiometricAuth()
  const [sheetVisible, setSheetVisible] = useState(false)
  const [assetCounts, setAssetCounts] = useState<Record<string, number>>({})
  const dbInitialized = useRef(false)

  useEffect(() => {
    if (!dbInitialized.current) {
      dbInitialized.current = true
      void initDb().then(() => loadAlbums())
    }
  }, [loadAlbums])

  useEffect(() => {
    if (albums.length === 0) return
    void Promise.all(
      albums.map(async (album) => {
        const { getAlbumAssetIds } = await import('@/lib/db')
        const ids = await getAlbumAssetIds(album.id)
        return [album.id, ids.length] as const
      }),
    ).then((entries) => {
      setAssetCounts(Object.fromEntries(entries))
    })
  }, [albums])

  const handleAlbumPress = useCallback(
    async (album: Album) => {
      if (album.isPrivate) {
        const success = await authenticate(`Unlock "${album.name}"`)
        if (!success) {
          Alert.alert('Authentication Required', 'Biometric authentication is required to open this album.')
          return
        }
      }
      router.push(`/album/${album.id}`)
    },
    [authenticate, router],
  )

  function handleCreated(albumId: string) {
    setSheetVisible(false)
    router.push(`/album/${albumId}`)
  }

  const rows: AlbumRow[] = []
  for (let i = 0; i < albums.length; i += 2) {
    const left = albums[i]
    const right = albums[i + 1] ?? null
    if (left === undefined) break
    rows.push({
      left,
      right,
      leftCount: assetCounts[left.id] ?? 0,
      rightCount: right !== null ? (assetCounts[right.id] ?? 0) : 0,
    })
  }

  function renderRow({ item }: ListRenderItemInfo<AlbumRow>) {
    return (
      <View style={styles.row}>
        <AlbumCard
          album={item.left}
          assetCount={item.leftCount}
          onPress={() => { void handleAlbumPress(item.left) }}
        />
        {item.right !== null ? (
          <AlbumCard
            album={item.right}
            assetCount={item.rightCount}
            onPress={() => {
              const right = item.right
              if (right !== null) void handleAlbumPress(right)
            }}
          />
        ) : (
          <View style={styles.cardPlaceholder} />
        )}
      </View>
    )
  }

  function keyExtractor(item: AlbumRow): string {
    return item.left.id
  }

  const fabBottom = insets.bottom > 0 ? insets.bottom + 16 : 32

  return (
    <>
      <Stack.Screen options={{ title: 'Albums' }} />

      <View style={styles.screen}>
        {isLoading && albums.length === 0 ? (
          <View style={styles.skeletonGrid}>
            {Array.from({ length: SKELETON_ALBUM_COUNT / 2 }).map((_, rowIndex) => (
              <View key={rowIndex} style={styles.skeletonRow}>
                {Array.from({ length: 2 }).map((__, colIndex) => (
                  <Skeleton
                    key={colIndex}
                    width={ALBUM_CARD_SIZE}
                    height={ALBUM_CARD_SIZE}
                    borderRadius={theme.radius.sm}
                  />
                ))}
              </View>
            ))}
          </View>
        ) : !isLoading && albums.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No Albums Yet</Text>
            <Text style={styles.emptyBody}>Tap + to create your first album.</Text>
          </View>
        ) : (
          <FlashList
            data={rows}
            renderItem={renderRow}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
          />
        )}

        <Pressable
          style={[styles.fab, { bottom: fabBottom }]}
          onPress={() => { setSheetVisible(true) }}
          accessibilityRole="button"
          accessibilityLabel="Create album"
        >
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      </View>

      <CreateAlbumSheet
        visible={sheetVisible}
        onClose={() => { setSheetVisible(false) }}
        onCreated={handleCreated}
      />
    </>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  skeletonGrid: {
    padding: theme.spacing.sm + 4,
    gap: 4,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listContent: {
    padding: theme.spacing.sm + 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardPlaceholder: {
    flex: 1,
    marginHorizontal: 4,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  emptyTitle: {
    ...theme.typography.headline,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptyBody: {
    ...theme.typography.body,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  fabIcon: {
    fontSize: 28,
    color: theme.colors.text,
    lineHeight: 32,
  },
})
