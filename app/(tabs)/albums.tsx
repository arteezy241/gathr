import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dimensions, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PILL_HEIGHT, PILL_MARGIN_BOTTOM } from '@/components/ui/FloatingTabBar'
import { importNativeAlbums } from '@/lib/nativeAlbumImport'
import { hapticAction, hapticSuccess } from '@/lib/haptics'
import { type Album, initDb } from '@/lib/db'
import { useAlbumStore } from '@/store/albumStore'
import { useBiometricAuth } from '@/features/private-albums/hooks/useBiometricAuth'
import { AlbumCard } from '@/features/albums/components/AlbumCard'
import { CreateAlbumSheet } from '@/features/albums/components/CreateAlbumSheet'
import { AlbumsEmptyState } from '@/features/albums/components/AlbumsEmptyState'
import { PermissionsEmptyState } from '@/components/ui/PermissionsEmptyState'
import { useTheme } from '@/lib/themeContext'
import { usePermissions } from '@/hooks/usePermissions'
import { radius, spacing, type ThemeColors } from '@/lib/theme'
import { useSheet } from '@/components/ui/SheetProvider'

const GAP = 10
const HORIZONTAL_PAD = 16
const ALBUM_CARD_SIZE = Math.floor((Dimensions.get('window').width - HORIZONTAL_PAD * 2 - GAP) / 2)
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
  const { colors } = useTheme()
  const { granted, requesting } = usePermissions()
  const { albums, isLoading, loadAlbums } = useAlbumStore()
  const { authenticate } = useBiometricAuth()
  const [sheetVisible, setSheetVisible] = useState(false)
  const [query, setQuery] = useState('')
  const [assetCounts, setAssetCounts] = useState<Record<string, number>>({})
  const [isImporting, setIsImporting] = useState(false)
  type SortKey = 'name' | 'newest' | 'oldest' | 'count'
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const dbInitialized = useRef(false)
  const { showInfo, showSheet } = useSheet()

  const bottomPad = insets.bottom + PILL_MARGIN_BOTTOM + PILL_HEIGHT + 8
  const styles = useMemo(() => makeStyles(colors, insets.top, bottomPad), [colors, insets.top, bottomPad])

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
          showInfo('Authentication Required', 'Biometric authentication is required to open this album.')
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

  async function handleImport(): Promise<void> {
    if (isImporting) return
    hapticAction()
    setIsImporting(true)
    try {
      const result = await importNativeAlbums()
      await loadAlbums()
      hapticSuccess()
      showInfo(
        'Import Complete',
        result.imported > 0
          ? `Imported ${String(result.imported)} album${result.imported === 1 ? '' : 's'} from your device.`
          : 'No new albums found to import.',
      )
    } catch (e) {
      showInfo('Import Failed', e instanceof Error ? e.message : 'Could not import albums.')
    } finally {
      setIsImporting(false)
    }
  }

  function handleSort() {
    showSheet({
      title: 'Sort Albums',
      actions: [
        { label: 'Name (A–Z)', onPress: () => { setSortKey('name') } },
        { label: 'Newest first', onPress: () => { setSortKey('newest') } },
        { label: 'Oldest first', onPress: () => { setSortKey('oldest') } },
        { label: 'Most photos', onPress: () => { setSortKey('count') } },
      ],
    })
  }

  const sortedAlbums = useMemo(() => {
    const base = query.trim().length > 0
      ? albums.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
      : albums
    const copy = [...base]
    if (sortKey === 'name') copy.sort((a, b) => a.name.localeCompare(b.name))
    else if (sortKey === 'newest') copy.sort((a, b) => b.createdAt - a.createdAt)
    else if (sortKey === 'oldest') copy.sort((a, b) => a.createdAt - b.createdAt)
    else copy.sort((a, b) => (assetCounts[b.id] ?? 0) - (assetCounts[a.id] ?? 0))
    return copy
  }, [albums, query, sortKey, assetCounts])

  const rows: AlbumRow[] = []
  for (let i = 0; i < sortedAlbums.length; i += 2) {
    const left = sortedAlbums[i]
    const right = sortedAlbums[i + 1] ?? null
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

  const fabBottom = bottomPad + 16

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchBar}
            placeholder="Search albums…"
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          <Pressable onPress={handleSort} style={styles.importButton} hitSlop={8}>
            <Ionicons name="swap-vertical-outline" size={20} color={colors.accent} />
          </Pressable>
          <Pressable onPress={() => { router.push('/duplicates') }} style={styles.importButton} hitSlop={8}>
            <Ionicons name="copy-outline" size={20} color={colors.accent} />
          </Pressable>
          <Pressable onPress={() => { router.push('/trash') }} style={styles.importButton} hitSlop={8}>
            <Ionicons name="trash-outline" size={20} color={colors.accent} />
          </Pressable>
          <Pressable
            onPress={() => { void handleImport() }}
            style={styles.importButton}
            disabled={isImporting}
            hitSlop={8}
          >
            <Ionicons
              name={isImporting ? 'hourglass-outline' : 'download-outline'}
              size={20}
              color={isImporting ? colors.textTertiary : colors.accent}
            />
          </Pressable>
        </View>
        {!requesting && !granted ? (
          <PermissionsEmptyState />
        ) : isLoading && albums.length === 0 ? (
          <View style={styles.skeletonGrid}>
            {Array.from({ length: SKELETON_ALBUM_COUNT / 2 }).map((_, rowIndex) => (
              <View key={rowIndex} style={styles.skeletonRow}>
                {Array.from({ length: 2 }).map((__, colIndex) => (
                  <Skeleton
                    key={colIndex}
                    width={ALBUM_CARD_SIZE}
                    height={ALBUM_CARD_SIZE}
                    borderRadius={radius.sm}
                  />
                ))}
              </View>
            ))}
          </View>
        ) : !isLoading && albums.length === 0 ? (
          <AlbumsEmptyState onCreateAlbum={() => { hapticAction(); setSheetVisible(true) }} />
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
          onPress={() => { hapticAction(); setSheetVisible(true) }}
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

function makeStyles(colors: ThemeColors, topPad: number, bottomPad: number) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: topPad,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: HORIZONTAL_PAD,
      marginTop: spacing.sm,
      marginBottom: spacing.sm + 2,
      gap: 8,
    },
    searchBar: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      fontSize: 15,
      color: colors.text,
    },
    importButton: {
      width: 38,
      height: 38,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    skeletonGrid: {
      paddingHorizontal: HORIZONTAL_PAD,
      gap: GAP,
    },
    skeletonRow: {
      flexDirection: 'row',
      gap: GAP,
    },
    listContent: {
      paddingHorizontal: HORIZONTAL_PAD,
      paddingTop: 4,
      paddingBottom: bottomPad,
    },
    row: {
      flexDirection: 'row',
      gap: GAP,
      marginBottom: GAP,
    },
    cardPlaceholder: {
      width: ALBUM_CARD_SIZE,
    },
    fab: {
      position: 'absolute',
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
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
      color: '#FFFFFF',
      lineHeight: 32,
    },
  })
}
