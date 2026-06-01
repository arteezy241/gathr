import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Stack } from 'expo-router'
import { Image } from 'expo-image'
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTrashStore, type TrashItem } from '@/store/trashStore'
import { useTheme } from '@/lib/themeContext'
import { spacing, typography, type ThemeColors } from '@/lib/theme'
import { hapticWarning, hapticSuccess, hapticTap } from '@/lib/haptics'
import { useSheet } from '@/components/ui/SheetProvider'

const NUM_COLS = 3
const SCREEN_W = Dimensions.get('window').width
const GAP = 2
const THUMB_SIZE = Math.floor((SCREEN_W - GAP * (NUM_COLS - 1)) / NUM_COLS)

interface PhotoRow {
  items: TrashItem[]
  rowIndex: number
}

function rowKey(row: PhotoRow): string {
  return `row-${row.items[0]?.assetId ?? String(row.rowIndex)}`
}

// ── Peek modal ────────────────────────────────────────────────────────────────

interface PeekModalProps {
  item: TrashItem
  onClose: () => void
  onRestore: () => void
  onDeleteForever: () => void
}

function PeekModal({ item, onClose, onRestore, onDeleteForever }: PeekModalProps) {
  const { colors } = useTheme()
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const cardScale = useRef(new Animated.Value(0.88)).current
  const cardOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, speed: 32, bounciness: 8 }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start()
  }, [backdropOpacity, cardScale, cardOpacity])

  function dismiss(cb: () => void) {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 0.92, duration: 130, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 130, useNativeDriver: true }),
    ]).start(() => { cb() })
  }

  const previewW = SCREEN_W * 0.82
  const previewH = Dimensions.get('window').height * 0.58

  return (
    <Modal transparent animationType="none" statusBarTranslucent>
      <View style={peekStyles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, peekStyles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { dismiss(onClose) }} />
        </Animated.View>
        <Animated.View
          style={[
            peekStyles.card,
            { width: previewW, backgroundColor: colors.surface, transform: [{ scale: cardScale }], opacity: cardOpacity },
          ]}
        >
          <Image
            source={{ uri: item.uri }}
            style={{ width: previewW, height: previewH }}
            contentFit="contain"
            recyclingKey={item.assetId}
            transition={180}
          />
          <View style={[peekStyles.actions, { borderTopColor: colors.border }]}>
            <Pressable style={peekStyles.action} onPress={() => { hapticSuccess(); dismiss(onRestore) }}>
              <Ionicons name="arrow-undo-outline" size={22} color={colors.accentGreen} />
              <Text style={[peekStyles.actionLabel, { color: colors.accentGreen }]}>Restore</Text>
            </Pressable>
            <View style={[peekStyles.divider, { backgroundColor: colors.border }]} />
            <Pressable style={peekStyles.action} onPress={() => { hapticWarning(); dismiss(onDeleteForever) }}>
              <Ionicons name="trash" size={22} color={colors.accentRed} />
              <Text style={[peekStyles.actionLabel, { color: colors.accentRed }]}>Delete Forever</Text>
            </Pressable>
            <View style={[peekStyles.divider, { backgroundColor: colors.border }]} />
            <Pressable style={peekStyles.action} onPress={() => { dismiss(onClose) }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
              <Text style={[peekStyles.actionLabel, { color: colors.textSecondary }]}>Close</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const peekStyles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 20,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 4,
  },
  actionLabel: { fontSize: 11, fontWeight: '500' },
  divider: { width: StyleSheet.hairlineWidth, marginVertical: 10 },
})

// ── Countdown badge ───────────────────────────────────────────────────────────

function CountdownBadge({ days, colors }: { days: number; colors: ThemeColors }) {
  const urgent = days <= 5
  return (
    <View style={[badgeStyles.badge, { backgroundColor: urgent ? colors.accentRed : 'rgba(0,0,0,0.55)' }]}>
      <Text style={badgeStyles.text}>{String(days)}d</Text>
    </View>
  )
}

const badgeStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  text: { fontSize: 10, fontWeight: '600', color: '#fff' },
})

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ colors }: { colors: ThemeColors }) {
  return (
    <View style={emptyStyles.root}>
      {/* Simple SVG-style trash icon using View + Text */}
      <View style={[emptyStyles.iconWrap, { borderColor: colors.border }]}>
        <Ionicons name="trash-outline" size={48} color={colors.textTertiary} />
      </View>
      <Text style={[emptyStyles.title, { color: colors.text }]}>Trash is empty</Text>
      <Text style={[emptyStyles.body, { color: colors.textTertiary }]}>
        Photos moved to trash are permanently deleted after 30 days.
      </Text>
    </View>
  )
}

const emptyStyles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.title, marginBottom: spacing.sm },
  body: { ...typography.body, textAlign: 'center', lineHeight: 22 },
})

// ── Main screen ───────────────────────────────────────────────────────────────

export default function TrashScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top])
  const { items, isLoading, loadTrash, permanentlyDelete, restoreFromTrash, emptyTrash } = useTrashStore()
  const { showConfirm } = useSheet()
  const [peekItem, setPeekItem] = useState<TrashItem | null>(null)

  useEffect(() => {
    void loadTrash()
  }, [loadTrash])

  const rows = useMemo<PhotoRow[]>(() => {
    const result: PhotoRow[] = []
    for (let i = 0; i < items.length; i += NUM_COLS) {
      result.push({ items: items.slice(i, i + NUM_COLS), rowIndex: i / NUM_COLS })
    }
    return result
  }, [items])

  function handleEmptyTrash() {
    if (items.length === 0) return
    hapticWarning()
    showConfirm(
      'Empty Trash',
      `Permanently delete all ${String(items.length)} ${items.length === 1 ? 'photo' : 'photos'}? This cannot be undone.`,
      () => { void emptyTrash() },
      { confirmLabel: 'Delete All', destructive: true },
    )
  }

  function handleDeleteForever(assetId: string) {
    hapticWarning()
    showConfirm(
      'Delete Forever',
      'This photo will be permanently deleted and cannot be recovered.',
      () => { void permanentlyDelete(assetId) },
      { confirmLabel: 'Delete', destructive: true },
    )
  }

  const renderRow = useCallback(({ item }: ListRenderItemInfo<PhotoRow>) => (
    <View style={styles.row}>
      {item.items.map((trashItem) => (
        <Pressable
          key={trashItem.assetId}
          onPress={() => { hapticTap(); setPeekItem(trashItem) }}
          onLongPress={() => { hapticTap(); setPeekItem(trashItem) }}
          delayLongPress={400}
        >
          <View style={styles.thumb}>
            <Image
              source={{ uri: trashItem.uri }}
              style={styles.thumbImage}
              contentFit="cover"
              recyclingKey={trashItem.assetId}
              transition={120}
            />
            <CountdownBadge days={trashItem.daysRemaining} colors={colors} />
          </View>
        </Pressable>
      ))}
      {item.items.length < NUM_COLS &&
        Array.from({ length: NUM_COLS - item.items.length }).map((_, i) => (
          <View key={`empty-${String(i)}`} style={styles.thumb} />
        ))}
    </View>
  ), [styles, colors])

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Recently Deleted',
          ...(items.length > 0 && {
            headerRight: () => (
              <Pressable onPress={handleEmptyTrash} hitSlop={8}>
                <Text style={[styles.emptyButton, { color: colors.accentRed }]}>Empty</Text>
              </Pressable>
            ),
          }),
        }}
      />
      <View style={styles.screen}>
        {!isLoading && items.length === 0 ? (
          <EmptyState colors={colors} />
        ) : (
          <FlashList
            data={rows}
            renderItem={renderRow}
            keyExtractor={rowKey}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              items.length > 0 ? (
                <Text style={[styles.hint, { color: colors.textTertiary }]}>
                  Photos are permanently deleted after 30 days.
                </Text>
              ) : null
            }
          />
        )}
      </View>

      {peekItem !== null && (
        <PeekModal
          item={peekItem}
          onClose={() => { setPeekItem(null) }}
          onRestore={() => {
            const id = peekItem.assetId
            setPeekItem(null)
            void restoreFromTrash(id)
          }}
          onDeleteForever={() => {
            const id = peekItem.assetId
            setPeekItem(null)
            handleDeleteForever(id)
          }}
        />
      )}
    </>
  )
}

function makeStyles(colors: ThemeColors, topPad: number) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.OS === 'ios' ? 0 : topPad,
    },
    hint: {
      ...typography.caption,
      textAlign: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    row: {
      flexDirection: 'row',
      gap: GAP,
      marginBottom: GAP,
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      backgroundColor: colors.surfaceElevated,
    },
    thumbImage: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
    },
    emptyButton: {
      ...typography.bodyMedium,
    },
  })
}
