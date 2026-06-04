import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { Stack, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PILL_HEIGHT, PILL_MARGIN_BOTTOM } from '@/components/ui/FloatingTabBar'
import { importNativeAlbums } from '@/lib/nativeAlbumImport'
import { hapticAction, hapticSuccess, hapticWarning } from '@/lib/haptics'
import { type Album, initDb } from '@/lib/db'
import { useAlbumStore } from '@/store/albumStore'
import { useBiometricAuth } from '@/features/private-albums/hooks/useBiometricAuth'
import { AlbumCard, CARD_SIZE, GRID_GAP } from '@/features/albums/components/AlbumCard'
import { CreateAlbumSheet } from '@/features/albums/components/CreateAlbumSheet'
import { AlbumsEmptyState } from '@/features/albums/components/AlbumsEmptyState'
import { PermissionsEmptyState } from '@/components/ui/PermissionsEmptyState'
import { useTheme } from '@/lib/themeContext'
import { usePermissions } from '@/hooks/usePermissions'
import { radius, type ThemeColors } from '@/lib/theme'
import { useSheet } from '@/components/ui/SheetProvider'

const SKELETON_ALBUM_COUNT = 4

interface AlbumRow {
  left: Album
  right: Album | null
  leftCount: number
  rightCount: number
}

// ─── Context menu ─────────────────────────────────────────────────────────────
interface ContextMenuProps {
  album: Album
  assetCount: number
  onClose: () => void
  onRename: () => void
  onTogglePrivate: () => void
  onDelete: () => void
}

function AlbumContextMenu({ album, assetCount, onClose, onRename, onTogglePrivate, onDelete }: ContextMenuProps) {
  const coverSrc = album.coverAssetId
    ? { uri: Platform.OS === 'ios' ? `ph://${album.coverAssetId}` : album.coverAssetId }
    : null

  const items = [
    { icon: 'pencil-outline' as const,   label: 'Rename',                              action: () => { onClose(); onRename() },           danger: false },
    { icon: 'share-outline' as const,     label: 'Share Album',                          action: onClose,                                   danger: false },
    null,
    { icon: album.isPrivate ? 'eye-outline' as const : 'lock-closed-outline' as const,
                                          label: album.isPrivate ? 'Make Public' : 'Make Private',
                                                                                         action: () => { onTogglePrivate(); onClose() },    danger: false },
    null,
    { icon: 'trash-outline' as const,     label: 'Delete Album',                         action: () => { onClose(); onDelete() },           danger: true  },
  ]

  return (
    <View style={ctx.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={ctx.panel}>
        {/* Album badge */}
        <View style={ctx.badge}>
          <View style={ctx.thumb}>
            {coverSrc ? (
              <Image source={coverSrc} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2a1e3e' }]} />
            )}
          </View>
          <View>
            <Text style={ctx.badgeName}>{album.name}</Text>
            <Text style={ctx.badgeCount}>{assetCount.toLocaleString()} photos</Text>
          </View>
        </View>
        <View style={ctx.divider} />

        {items.map((item, i) =>
          item === null ? (
            <View key={`sep-${String(i)}`} style={ctx.itemDivider} />
          ) : (
            <Pressable
              key={item.label}
              onPress={item.action}
              style={({ pressed }) => [ctx.item, pressed && ctx.itemPressed]}
            >
              <Ionicons name={item.icon} size={16} color={item.danger ? '#FF6060' : 'rgba(235,235,245,0.65)'} />
              <Text style={[ctx.itemLabel, item.danger && ctx.itemDanger]}>{item.label}</Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  )
}

const ctx = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 150,
    backgroundColor: 'rgba(0,0,0,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    width: 224,
    backgroundColor: 'rgba(26,20,40,0.98)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingBottom: 14,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#2a1e3e',
  },
  badgeName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  badgeCount: {
    color: 'rgba(235,235,245,0.45)',
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  itemDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  itemLabel: {
    color: '#fff',
    fontSize: 14.5,
  },
  itemDanger: {
    color: '#FF6060',
  },
})

// ─── Rename sheet ──────────────────────────────────────────────────────────────
interface RenameSheetProps {
  album: Album
  onClose: () => void
  onSave: (name: string) => void
}

function RenameSheet({ album, onClose, onSave }: RenameSheetProps) {
  const [name, setName] = useState(album.name)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    const t = setTimeout(() => { inputRef.current?.focus(); inputRef.current?.setSelection(0, album.name.length) }, 80)
    return () => { clearTimeout(t); }
  }, [album.name])

  function handleSave() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== album.name) onSave(trimmed)
    onClose()
  }

  const canSave = name.trim().length > 0

  return (
    <View style={sh.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={sh.sheet}>
        <View style={sh.handle} />
        <Text style={sh.label}>Rename Album</Text>
        <TextInput
          ref={inputRef}
          value={name}
          onChangeText={setName}
          onFocus={() => { setFocused(true); }}
          onBlur={() => { setFocused(false); }}
          onSubmitEditing={handleSave}
          style={[sh.input, focused && sh.inputFocused]}
          selectionColor="#A488BE"
          autoCorrect={false}
        />
        <View style={sh.divider} />
        <View style={sh.btnRow}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [sh.btnCancel, pressed && { opacity: 0.7 }]}
          >
            <Text style={sh.btnCancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={[sh.btnSave, !canSave && sh.btnSaveDisabled]}
          >
            <Text style={[sh.btnSaveText, !canSave && sh.btnSaveTextDisabled]}>Save</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const sh = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.54)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'rgba(24,18,36,0.99)',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 20,
    paddingTop: 8,
    paddingBottom: 44,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  label: {
    color: 'rgba(235,235,245,0.45)',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#fff',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  inputFocused: {
    borderColor: 'rgba(164,136,190,0.55)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 18,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 22,
    alignItems: 'center',
  },
  btnCancelText: {
    color: 'rgba(235,235,245,0.60)',
    fontSize: 15,
    fontWeight: '500',
  },
  btnSave: {
    flex: 1,
    paddingVertical: 13,
    backgroundColor: '#A488BE',
    borderRadius: 22,
    alignItems: 'center',
  },
  btnSaveDisabled: {
    backgroundColor: 'rgba(164,136,190,0.28)',
  },
  btnSaveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  btnSaveTextDisabled: {
    color: 'rgba(164,136,190,0.55)',
  },
})

// ─── Delete confirm ───────────────────────────────────────────────────────────
interface DeleteConfirmProps {
  album: Album
  onClose: () => void
  onConfirm: () => void
}

function DeleteConfirm({ album, onClose, onConfirm }: DeleteConfirmProps) {
  return (
    <View style={dc.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={dc.panel}>
        <Text style={dc.title}>Delete "{album.name}"?</Text>
        <Text style={dc.body}>The album will be removed. Photos stay in your library.</Text>
        <View style={dc.divider} />
        <View style={dc.btnRow}>
          <Pressable onPress={onClose} style={({ pressed }) => [dc.btn, dc.btnLeft, pressed && { opacity: 0.6 }]}>
            <Text style={dc.btnText}>Cancel</Text>
          </Pressable>
          <View style={dc.btnDivider} />
          <Pressable onPress={() => { onConfirm(); onClose() }} style={({ pressed }) => [dc.btn, pressed && { opacity: 0.6 }]}>
            <Text style={[dc.btnText, dc.btnDelete]}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const dc = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 160,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    width: 260,
    backgroundColor: 'rgba(26,20,40,0.99)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
    paddingTop: 22,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  body: {
    color: 'rgba(235,235,245,0.45)',
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  btnRow: {
    flexDirection: 'row',
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnLeft: {},
  btnDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  btnText: {
    color: 'rgba(235,235,245,0.70)',
    fontSize: 15,
  },
  btnDelete: {
    color: '#FF6060',
    fontWeight: '600',
  },
})

// ─── Sort dropdown ────────────────────────────────────────────────────────────
type SortKey = 'name' | 'newest' | 'oldest' | 'count'
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name',   label: 'Name' },
  { key: 'newest', label: 'Date created' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'count',  label: 'Photo count' },
]

// ─── Albums screen ────────────────────────────────────────────────────────────
export default function AlbumsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { granted, requesting } = usePermissions()
  const { albums, isLoading, loadAlbums, removeAlbum, renameAlbum, toggleAlbumPrivate } = useAlbumStore()
  const { authenticate } = useBiometricAuth()
  const [sheetVisible, setSheetVisible] = useState(false)
  const [assetCounts, setAssetCounts] = useState<Record<string, number>>({})
  const [isImporting, setIsImporting] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [sortOpen, setSortOpen] = useState(false)
  const [contextAlbum, setContextAlbum] = useState<Album | null>(null)
  const [renameTarget, setRenameTarget] = useState<Album | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Album | null>(null)
  const dbInitialized = useRef(false)
  const { showInfo } = useSheet()

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
    [authenticate, router, showInfo],
  )

  const handleLongPress = useCallback((album: Album) => {
    hapticAction()
    setContextAlbum(album)
  }, [])

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

  const handleRename = useCallback(async (id: string, name: string) => {
    await renameAlbum(id, name)
  }, [renameAlbum])

  const handleTogglePrivate = useCallback(async (id: string) => {
    await toggleAlbumPrivate(id)
  }, [toggleAlbumPrivate])

  const handleDelete = useCallback(async (id: string) => {
    hapticWarning()
    await removeAlbum(id)
  }, [removeAlbum])

  const sortedAlbums = useMemo(() => {
    const copy = [...albums]
    if (sortKey === 'name') copy.sort((a, b) => a.name.localeCompare(b.name))
    else if (sortKey === 'newest') copy.sort((a, b) => b.createdAt - a.createdAt)
    else if (sortKey === 'oldest') copy.sort((a, b) => a.createdAt - b.createdAt)
    else copy.sort((a, b) => (assetCounts[b.id] ?? 0) - (assetCounts[a.id] ?? 0))
    return copy
  }, [albums, sortKey, assetCounts])

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
          onLongPress={() => { handleLongPress(item.left); }}
        />
        {item.right !== null ? (
          <AlbumCard
            album={item.right}
            assetCount={item.rightCount}
            onPress={() => {
              const right = item.right
              if (right !== null) void handleAlbumPress(right)
            }}
            onLongPress={() => {
              const right = item.right
              if (right !== null) handleLongPress(right)
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

  const isEmpty = !isLoading && albums.length === 0
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? 'Date created'

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        {/* ── Header ───────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>Albums</Text>
          <View style={styles.toolbar}>
            <Pressable
              onPress={() => { hapticAction(); setSheetVisible(true) }}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              hitSlop={8}
            >
              <Ionicons name="add" size={22} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => { void handleImport() }}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              disabled={isImporting}
              hitSlop={8}
            >
              {isImporting
                ? <ActivityIndicator size="small" color={colors.textTertiary} />
                : <Ionicons name="download-outline" size={20} color={colors.textSecondary} />}
            </Pressable>
            <Pressable
              onPress={() => { router.push('/trash') }}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* ── Sort pill ─────────────────────────────────────────── */}
        {!isEmpty && albums.length > 0 && (
          <View style={styles.sortRow}>
            <Pressable
              onPress={() => { setSortOpen((v) => !v); }}
              style={[styles.sortPill, sortOpen && styles.sortPillActive]}
            >
              <Ionicons name="funnel-outline" size={12} color={sortOpen ? '#A488BE' : 'rgba(235,235,245,0.45)'} />
              <Text style={[styles.sortPillText, sortOpen && styles.sortPillTextActive]}>{sortLabel}</Text>
              <Ionicons name="chevron-down" size={11} color={sortOpen ? '#A488BE' : 'rgba(235,235,245,0.30)'} />
            </Pressable>

            {sortOpen && (
              <>
                <Pressable style={StyleSheet.absoluteFill} onPress={() => { setSortOpen(false); }} />
                <View style={styles.sortDropdown}>
                  {SORT_OPTIONS.map((opt, i) => (
                    <View key={opt.key}>
                      {i > 0 && <View style={styles.sortDivider} />}
                      <Pressable
                        onPress={() => { setSortKey(opt.key); setSortOpen(false) }}
                        style={({ pressed }) => [styles.sortItem, pressed && styles.sortItemPressed]}
                      >
                        <Text style={[styles.sortItemText, opt.key === sortKey && styles.sortItemTextActive]}>
                          {opt.label}
                        </Text>
                        {opt.key === sortKey && (
                          <Ionicons name="checkmark" size={14} color="#A488BE" />
                        )}
                      </Pressable>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Content ───────────────────────────────────────────── */}
        {!requesting && !granted ? (
          <PermissionsEmptyState />
        ) : isLoading && albums.length === 0 ? (
          <View style={styles.skeletonGrid}>
            {Array.from({ length: SKELETON_ALBUM_COUNT / 2 }).map((_, rowIndex) => (
              <View key={rowIndex} style={styles.skeletonRow}>
                {Array.from({ length: 2 }).map((__, colIndex) => (
                  <Skeleton
                    key={colIndex}
                    width={CARD_SIZE}
                    height={CARD_SIZE}
                    borderRadius={radius.sm}
                  />
                ))}
              </View>
            ))}
          </View>
        ) : isEmpty ? (
          <AlbumsEmptyState onCreateAlbum={() => { hapticAction(); setSheetVisible(true) }} />
        ) : (
          <FlashList
            data={rows}
            renderItem={renderRow}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
          />
        )}

        {/* ── Overlays ──────────────────────────────────────────── */}
        {contextAlbum && (
          <AlbumContextMenu
            album={contextAlbum}
            assetCount={assetCounts[contextAlbum.id] ?? 0}
            onClose={() => { setContextAlbum(null); }}
            onRename={() => { setRenameTarget(contextAlbum); setContextAlbum(null) }}
            onTogglePrivate={() => { void handleTogglePrivate(contextAlbum.id); setContextAlbum(null) }}
            onDelete={() => { setDeleteTarget(contextAlbum); setContextAlbum(null) }}
          />
        )}

        {renameTarget && (
          <RenameSheet
            album={renameTarget}
            onClose={() => { setRenameTarget(null); }}
            onSave={(name) => { void handleRename(renameTarget.id, name) }}
          />
        )}

        {deleteTarget && (
          <DeleteConfirm
            album={deleteTarget}
            onClose={() => { setDeleteTarget(null); }}
            onConfirm={() => { void handleDelete(deleteTarget.id) }}
          />
        )}
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingTop: 4,
      paddingBottom: 6,
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.5,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtnPressed: {
      backgroundColor: 'rgba(255,255,255,0.09)',
    },
    sortRow: {
      paddingHorizontal: 14,
      paddingBottom: 8,
      zIndex: 200,
    },
    sortPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      paddingVertical: 5,
      paddingHorizontal: 10,
      paddingLeft: 10,
      backgroundColor: 'rgba(255,255,255,0.07)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.09)',
      borderRadius: 20,
    },
    sortPillActive: {
      backgroundColor: 'rgba(164,136,190,0.18)',
      borderColor: 'rgba(164,136,190,0.30)',
    },
    sortPillText: {
      color: 'rgba(235,235,245,0.45)',
      fontSize: 12.5,
      fontWeight: '500',
    },
    sortPillTextActive: {
      color: '#A488BE',
    },
    sortDropdown: {
      position: 'absolute',
      top: 36,
      left: 14,
      width: 182,
      backgroundColor: 'rgba(28,22,40,0.97)',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.09)',
      overflow: 'hidden',
      zIndex: 200,
    },
    sortDivider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.06)',
      marginHorizontal: 10,
    },
    sortItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    sortItemPressed: {
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    sortItemText: {
      color: colors.text,
      fontSize: 13.5,
    },
    sortItemTextActive: {
      color: '#A488BE',
      fontWeight: '500',
    },
    skeletonGrid: {
      gap: GRID_GAP,
    },
    skeletonRow: {
      flexDirection: 'row',
      gap: GRID_GAP,
    },
    listContent: {
      paddingBottom: bottomPad,
    },
    row: {
      flexDirection: 'row',
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    cardPlaceholder: {
      width: CARD_SIZE,
    },
  })
}
