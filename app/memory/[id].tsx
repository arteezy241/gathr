import { useEffect, useMemo, useState } from 'react'
import { Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMemoriesStore } from '@/store/memoriesStore'
import { getPhotosByDateRange } from '@/lib/mediaLibrary'
import { type Asset } from 'expo-media-library/next'
import { useTheme } from '@/lib/themeContext'
import { typography, type ThemeColors } from '@/lib/theme'
import { Skeleton } from '@/components/ui/Skeleton'

const SCREEN_W = Dimensions.get('window').width
const COLS = 3
const GAP = 2
const THUMB = Math.floor((SCREEN_W - GAP * (COLS - 1)) / COLS)

function assetUri(asset: Asset): string {
  return Platform.OS === 'ios' ? `ph://${asset.id}` : asset.id
}

/** Parse the target year from the memory id (format: "onthisday-YYYY"). */
function parseYear(id: string): number | null {
  const match = /onthisday-(\d{4})/.exec(id)
  return match !== null ? parseInt(match[1]!, 10) : null
}

function startOfDay(year: number, month: number, day: number): number {
  return new Date(year, month, day, 0, 0, 0, 0).getTime()
}

function endOfDay(year: number, month: number, day: number): number {
  return new Date(year, month, day, 23, 59, 59, 999).getTime()
}

export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const memories = useMemoriesStore((s) => s.memories)
  const memory = memories.find((m) => m.id === id)

  const [photos, setPhotos] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const year = parseYear(id ?? '')
    if (year === null) { setIsLoading(false); return }

    const now = new Date()
    void getPhotosByDateRange(
      startOfDay(year, now.getMonth(), now.getDate()),
      endOfDay(year, now.getMonth(), now.getDate()),
      200,
    ).then((assets) => {
      setPhotos(assets)
      setIsLoading(false)
    }).catch(() => { setIsLoading(false) })
  }, [id])

  // Build rows of COLS items for FlashList
  const rows = useMemo(() => {
    const result: Asset[][] = []
    for (let i = 0; i < photos.length; i += COLS) {
      result.push(photos.slice(i, i + COLS))
    }
    return result
  }, [photos])

  const title = memory?.label ?? 'Memory'
  const subtitle = memory?.subtitle ?? ''

  function renderRow({ item }: ListRenderItemInfo<Asset[]>) {
    return (
      <View style={styles.row}>
        {item.map((asset) => (
          <Pressable
            key={asset.id}
            onPress={() => {
              router.push({ pathname: '/photo/[id]', params: { id: asset.id, context: 'memory', contextId: id } })
            }}
          >
            <Image
              source={{ uri: assetUri(asset) }}
              style={styles.thumb}
              contentFit="cover"
              recyclingKey={asset.id}
              transition={100}
            />
          </Pressable>
        ))}
        {/* Fill empty slots in last row */}
        {Array.from({ length: COLS - item.length }).map((_, i) => (
          <View key={`empty-${String(i)}`} style={styles.thumb} />
        ))}
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />
      <View style={[styles.screen, { paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {subtitle.length > 0 && (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )}
        </View>

        {isLoading ? (
          <View style={styles.skeletonGrid}>
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} width={THUMB} height={THUMB} borderRadius={0} />
            ))}
          </View>
        ) : photos.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No photos found for this day.</Text>
          </View>
        ) : (
          <FlashList
            data={rows}
            renderItem={renderRow}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </>
  )
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
    },
    title: {
      ...typography.headline,
      fontSize: 22,
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      ...typography.body,
      color: colors.textTertiary,
    },
    row: {
      flexDirection: 'row',
      gap: GAP,
      marginBottom: GAP,
    },
    thumb: {
      width: THUMB,
      height: THUMB,
      backgroundColor: colors.surfaceElevated,
    },
    skeletonGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GAP,
      paddingHorizontal: 0,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emptyText: {
      ...typography.body,
      color: colors.textTertiary,
      textAlign: 'center',
    },
  })
}
