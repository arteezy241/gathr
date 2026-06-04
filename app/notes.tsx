import { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, FlatList, Platform, Pressable, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getAllNoteEntries, type NoteEntry } from '@/lib/db'
import { useTheme } from '@/lib/themeContext'
import { PILL_HEIGHT, PILL_MARGIN_BOTTOM } from '@/components/ui/FloatingTabBar'

const GAP = 10
const H_PAD = 16
const CARD_SIZE = Math.floor((Dimensions.get('window').width - H_PAD * 2 - GAP) / 2)

const AC = '#A488BE'

interface NoteRow {
  left: NoteEntry
  right: NoteEntry | null
  rowIndex: number
}

function assetUri(id: string) {
  return Platform.OS === 'ios' ? `ph://${id}` : id
}

function buildRows(entries: NoteEntry[]): NoteRow[] {
  const rows: NoteRow[] = []
  for (let i = 0; i < entries.length; i += 2) {
    rows.push({
      left: entries[i] as NoteEntry,
      right: entries[i + 1] ?? null,
      rowIndex: i / 2,
    })
  }
  return rows
}

function keyExtractor(item: NoteRow) {
  return `row-${item.rowIndex}`
}

function NoteCard({ entry, onPress }: { entry: NoteEntry; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start()
  }

  const preview = entry.noteText.length > 60
    ? entry.noteText.slice(0, 60).trimEnd() + '…'
    : entry.noteText

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        {/* Photo */}
        <Image
          source={{ uri: assetUri(entry.assetId) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={entry.assetId}
          transition={200}
        />

        {/* Gradient scrim */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.82)']}
          style={styles.scrim}
          pointerEvents="none"
        />

        {/* Note content */}
        <View style={styles.cardBody}>
          {entry.tags.length > 0 && (
            <View style={styles.tagRow}>
              {entry.tags.slice(0, 2).map((tag) => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={styles.tagText} numberOfLines={1}>{tag}</Text>
                </View>
              ))}
              {entry.tags.length > 2 && (
                <Text style={styles.tagMore}>+{entry.tags.length - 2}</Text>
              )}
            </View>
          )}
          <Text style={styles.notePreview} numberOfLines={2}>{preview}</Text>
        </View>

        {/* Corner dot */}
        <View style={styles.dot}>
          <Ionicons name="document-text" size={9} color="#fff" />
        </View>
      </Animated.View>
    </Pressable>
  )
}

export default function NotesScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const [entries, setEntries] = useState<NoteEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const bottomPad = insets.bottom + PILL_MARGIN_BOTTOM + PILL_HEIGHT + 8

  useEffect(() => {
    async function load() {
      const data = await getAllNoteEntries()
      setEntries(data)
      setIsLoading(false)
    }
    void load()
  }, [])

  const rows = buildRows(entries)

  function openPhoto(assetId: string) {
    router.push({
      pathname: '/photo/[id]',
      params: { id: assetId, context: 'album', assetIds: entries.map((e) => e.assetId).join(',') },
    })
  }

  function renderRow({ item }: ListRenderItemInfo<NoteRow>) {
    return (
      <View style={styles.row}>
        <NoteCard entry={item.left} onPress={() => { openPhoto(item.left.assetId) }} />
        {item.right !== null ? (
          <NoteCard entry={item.right} onPress={() => { openPhoto(item.right!.assetId) }} />
        ) : (
          <View style={styles.card} />
        )}
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => { router.back() }} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Notes</Text>
            {!isLoading && (
              <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                {entries.length} {entries.length === 1 ? 'photo' : 'photos'}
              </Text>
            )}
          </View>
        </View>

        {!isLoading && entries.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="document-text-outline" size={32} color={AC} />
            </View>
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
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: CARD_SIZE + GAP, offset: (CARD_SIZE + GAP) * index, index })}
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
    gap: 8,
    paddingHorizontal: H_PAD,
    paddingTop: 4,
    paddingBottom: 16,
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
    marginTop: 1,
  },
  list: {
    paddingHorizontal: H_PAD,
    paddingTop: 4,
    gap: GAP,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1A1A1E',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: CARD_SIZE * 0.65,
  },
  cardBody: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  tagPill: {
    backgroundColor: 'rgba(164,136,190,0.30)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagText: {
    color: AC,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  tagMore: {
    color: 'rgba(164,136,190,0.55)',
    fontSize: 10,
    fontWeight: '500',
    alignSelf: 'center',
  },
  notePreview: {
    color: 'rgba(235,235,245,0.90)',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    letterSpacing: 0.05,
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(164,136,190,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 80,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(164,136,190,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 48,
    lineHeight: 20,
  },
})
