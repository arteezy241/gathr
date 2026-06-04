import { useEffect, useState } from 'react'
import { Dimensions, FlatList, Platform, Pressable, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getAssetsWithNotes } from '@/lib/db'
import { useTheme } from '@/lib/themeContext'
import { PILL_HEIGHT, PILL_MARGIN_BOTTOM } from '@/components/ui/FloatingTabBar'

const GAP = 2
const NUM_COLUMNS = 3
const THUMB = Math.floor((Dimensions.get('window').width - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS)

interface PhotoRow {
  ids: string[]
  rowIndex: number
}

function assetUri(id: string) {
  return Platform.OS === 'ios' ? `ph://${id}` : id
}

function buildRows(ids: string[]): PhotoRow[] {
  const rows: PhotoRow[] = []
  for (let i = 0; i < ids.length; i += NUM_COLUMNS) {
    rows.push({ ids: ids.slice(i, i + NUM_COLUMNS), rowIndex: i / NUM_COLUMNS })
  }
  return rows
}

function keyExtractor(item: PhotoRow) {
  return `row-${item.rowIndex}`
}

export default function NotesScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const [assetIds, setAssetIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const bottomPad = insets.bottom + PILL_MARGIN_BOTTOM + PILL_HEIGHT + 8

  useEffect(() => {
    async function load() {
      const ids = await getAssetsWithNotes()
      setAssetIds(ids)
      setIsLoading(false)
    }
    void load()
  }, [])

  const rows = buildRows(assetIds)

  function renderRow({ item }: ListRenderItemInfo<PhotoRow>) {
    const cells = [...item.ids]
    while (cells.length < NUM_COLUMNS) cells.push('')

    return (
      <View style={styles.row}>
        {cells.map((id, col) =>
          id === '' ? (
            <View key={col} style={styles.thumb} />
          ) : (
            <Pressable
              key={id}
              style={styles.thumb}
              onPress={() => {
                router.push({
                  pathname: '/photo/[id]',
                  params: { id, context: 'album', assetIds: assetIds.join(',') },
                })
              }}
            >
              <Image
                source={{ uri: assetUri(id) }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                recyclingKey={id}
                transition={150}
              />
              <View style={styles.noteDot} pointerEvents="none">
                <Ionicons name="document-text" size={9} color="rgba(255,255,255,0.9)" />
              </View>
            </Pressable>
          ),
        )}
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => { router.back() }} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Notes</Text>
            {!isLoading && (
              <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                {assetIds.length} {assetIds.length === 1 ? 'photo' : 'photos'}
              </Text>
            )}
          </View>
        </View>

        {!isLoading && assetIds.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No notes yet</Text>
            <Text style={[styles.emptyBody, { color: colors.textTertiary }]}>
              Open any photo and tap Note to add one.
            </Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={keyExtractor}
            renderItem={renderRow}
            contentContainerStyle={{ paddingBottom: bottomPad }}
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: THUMB + GAP, offset: (THUMB + GAP) * index, index })}
          />
        )}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  backBtn: {
    marginRight: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 1,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
    marginBottom: GAP,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    backgroundColor: '#1A1A1E',
    overflow: 'hidden',
  },
  noteDot: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(164,136,190,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
})
