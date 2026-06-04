import { useEffect, useRef, useState } from 'react'

function NOOP() { /* intentional no-op absorbs tap events on the modal card */ }
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getAllNoteEntries, type NoteEntry } from '@/lib/db'
import { useTheme } from '@/lib/themeContext'
import { PILL_HEIGHT, PILL_MARGIN_BOTTOM } from '@/components/ui/FloatingTabBar'

const { width: SW, height: SH } = Dimensions.get('window')
const GAP = 10
const H_PAD = 16
const CARD_W = Math.floor((SW - H_PAD * 2 - GAP) / 2)
const PHOTO_H = Math.floor(CARD_W * 0.75)
const BODY_H = 88

const MODAL_W = SW - 40
const MODAL_PHOTO_H = Math.floor(MODAL_W * 0.72)

const AC = '#A488BE' // used only in the dark modal overlay

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
    rows.push({ left: entries[i] as NoteEntry, right: entries[i + 1] ?? null, rowIndex: i / 2 })
  }
  return rows
}

function NoteCard({ entry, onPress }: { entry: NoteEntry; onPress: () => void }) {
  const { colors } = useTheme()
  const scale = useRef(new Animated.Value(1)).current

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start()
  }

  const preview = entry.noteText.length > 55
    ? entry.noteText.slice(0, 55).trimEnd() + '…'
    : entry.noteText

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.card, { transform: [{ scale }], backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.photoWrap, { backgroundColor: colors.surfaceElevated }]}>
          <Image
            source={{ uri: assetUri(entry.assetId) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            recyclingKey={entry.assetId}
            transition={200}
          />
          <LinearGradient
            colors={['transparent', colors.surface] as readonly [string, string]}
            style={styles.photoFade}
            pointerEvents="none"
          />
        </View>
        <View style={styles.body}>
          <Text style={[styles.noteText, { color: colors.textSecondary }]} numberOfLines={3}>{preview}</Text>
          {entry.tags.length > 0 && (
            <View style={styles.tagRow}>
              {entry.tags.slice(0, 2).map((tag) => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={[styles.tagText, { color: colors.accent }]} numberOfLines={1}>{tag}</Text>
                </View>
              ))}
              {entry.tags.length > 2 && (
                <Text style={[styles.tagMore, { color: colors.textTertiary }]}>+{entry.tags.length - 2}</Text>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  )
}

function NoteDetailModal({
  entry,
  topInset,
  onClose,
  onOpenPhoto,
}: {
  entry: NoteEntry
  topInset: number
  onClose: () => void
  onOpenPhoto: () => void
}) {
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(progress, {
      toValue: 1,
      damping: 26,
      stiffness: 280,
      useNativeDriver: true,
    }).start()
  }, [progress])

  function dismiss() {
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(onClose)
  }

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] })
  const opacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.85, 1] })

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.modalOuter, { opacity }]}
    >
      {/* Scrim — blurs the notes screen behind the card */}
      <BlurView intensity={18} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.48)' }]}
        pointerEvents="none"
      />

      {/* Backdrop — tap anywhere outside card to dismiss */}
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />

      {/* Card — rendered after backdrop so intercepts touches on card area */}
      <Animated.View
        style={[styles.modalCardWrap, { transform: [{ scale }] }]}
        pointerEvents="box-none"
      >
        {/* Pressable absorbs card-area taps that miss interactive children */}
        <Pressable style={styles.modalCard} onPress={NOOP}>
          {/* Sharp photo */}
          <View style={[styles.modalPhotoWrap, { height: MODAL_PHOTO_H }]}>
            <Image
              source={{ uri: assetUri(entry.assetId) }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              recyclingKey={`modal-photo-${entry.assetId}`}
            />
            <LinearGradient
              colors={['transparent', 'rgba(12,12,14,0.85)', '#0C0C0E']}
              style={styles.modalGrad}
              pointerEvents="none"
            />
          </View>

          {/* Body */}
          <View style={styles.modalBody}>
            {entry.noteText.trim().length > 0 && (
              <ScrollView
                style={styles.modalNoteScroll}
                showsVerticalScrollIndicator={false}
                scrollEnabled={entry.noteText.length > 120}
              >
                <Text style={styles.modalNoteText}>{entry.noteText}</Text>
              </ScrollView>
            )}
            {entry.tags.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.modalTagScroll}
              >
                {entry.tags.map((tag) => (
                  <View key={tag} style={styles.tagPill}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
            <Pressable style={styles.openPhotoBtn} onPress={onOpenPhoto}>
              <Ionicons name="expand-outline" size={13} color={AC} />
              <Text style={styles.openPhotoBtnText}>Open Photo</Text>
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>

      {/* Close button */}
      <Pressable
        style={[styles.modalCloseBtn, { top: topInset + 10 }]}
        onPress={dismiss}
        hitSlop={16}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <Ionicons name="close" size={18} color="rgba(255,255,255,0.80)" />
      </Pressable>
    </Animated.View>
  )
}

export default function NotesScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const [entries, setEntries] = useState<NoteEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<NoteEntry | null>(null)

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
  const cardTotalH = PHOTO_H + BODY_H

  function openInViewer(assetId: string) {
    setSelectedEntry(null)
    router.push({
      pathname: '/photo/[id]',
      params: { id: assetId, context: 'album', assetIds: entries.map((e) => e.assetId).join(',') },
    })
  }

  function renderRow({ item }: ListRenderItemInfo<NoteRow>) {
    const right = item.right
    return (
      <View style={styles.row}>
        <NoteCard entry={item.left} onPress={() => { setSelectedEntry(item.left) }} />
        {right !== null ? (
          <NoteCard entry={right} onPress={() => { setSelectedEntry(right) }} />
        ) : (
          <View style={[styles.card, { opacity: 0 }]} />
        )}
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => { router.back() }} hitSlop={12}>
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
              <Ionicons name="document-text-outline" size={32} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No notes yet</Text>
            <Text style={[styles.emptyBody, { color: colors.textTertiary }]}>
              Open any photo and tap Note to add one.
            </Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => `row-${String(item.rowIndex)}`}
            renderItem={renderRow}
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: cardTotalH + GAP, offset: (cardTotalH + GAP) * index, index })}
          />
        )}
      </View>

      {/* Detail modal — rendered outside the scroll container */}
      {selectedEntry !== null && (
        <NoteDetailModal
          entry={selectedEntry}
          topInset={insets.top}
          onClose={() => { setSelectedEntry(null) }}
          onOpenPhoto={() => { openInViewer(selectedEntry.assetId) }}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // backgroundColor overridden inline with colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: H_PAD,
    paddingTop: 4,
    paddingBottom: 16,
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
    width: CARD_W,
    borderRadius: 14,
    overflow: 'hidden',
    // backgroundColor and borderColor overridden inline with theme colors
    borderWidth: StyleSheet.hairlineWidth,
  },
  photoWrap: {
    width: CARD_W,
    height: PHOTO_H,
    // backgroundColor overridden inline with colors.surfaceElevated
    overflow: 'hidden',
  },
  photoFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 28,
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    minHeight: BODY_H,
    gap: 8,
  },
  noteText: {
    color: 'rgba(235,235,245,0.85)', // overridden inline in NoteCard via colors.textSecondary
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    letterSpacing: 0.05,
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
  },
  tagPill: {
    backgroundColor: 'rgba(164,136,190,0.18)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagText: {
    color: '#A488BE', // overridden inline in NoteCard via colors.accent
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  tagMore: {
    color: 'rgba(164,136,190,0.45)', // overridden inline in NoteCard via colors.textTertiary
    fontSize: 10,
    fontWeight: '500',
    alignSelf: 'center',
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

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOuter: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  modalCardWrap: {
    width: MODAL_W,
  },
  modalCard: {
    width: MODAL_W,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0C0C0E',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalPhotoWrap: {
    width: MODAL_W,
    overflow: 'hidden',
    backgroundColor: '#1A1A1E',
  },
  modalGrad: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: Math.floor(MODAL_PHOTO_H * 0.5),
  },
  modalBody: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
  },
  modalNoteScroll: {
    maxHeight: SH * 0.18,
  },
  modalNoteText: {
    color: 'rgba(235,235,245,0.88)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
    letterSpacing: 0.05,
  },
  modalTagScroll: {
    gap: 6,
    flexDirection: 'row',
  },
  openPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(164,136,190,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(164,136,190,0.25)',
  },
  openPhotoBtnText: {
    color: AC,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 18,
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
})
