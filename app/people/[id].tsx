import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Asset, type MediaLibraryAsset } from '@/lib/mediaLibrary'
import { getAssetIdsForCluster } from '@/lib/db'
import { usePeopleStore } from '@/store/peopleStore'
import { useSelectionStore } from '@/store/selectionStore'
import { PhotoThumb } from '@/features/gallery/components/PhotoThumb'
import { SelectionBar } from '@/features/gallery/components/SelectionBar'
import { useTheme } from '@/lib/themeContext'
import { type ThemeColors } from '@/lib/theme'
import { hapticTap } from '@/lib/haptics'

const NUM_COLUMNS = 3
const SCREEN_WIDTH = Dimensions.get('window').width

interface PhotoRow {
  assets: MediaLibraryAsset[]
  rowIndex: number
}

function keyExtractor(item: PhotoRow): string {
  return `row-${item.assets[0]?.id ?? String(item.rowIndex)}`
}

function chunkAssets(assets: MediaLibraryAsset[]): PhotoRow[] {
  const rows: PhotoRow[] = []
  for (let i = 0; i < assets.length; i += NUM_COLUMNS) {
    rows.push({ assets: assets.slice(i, i + NUM_COLUMNS), rowIndex: i / NUM_COLUMNS })
  }
  return rows
}

export default function PersonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { clusters, renamePerson } = usePeopleStore()
  const { selectedIds, isSelecting, selectAll, setLastSelected } = useSelectionStore()

  const cluster = clusters.find((c) => c.id === id) ?? null
  const [assets, setAssets] = useState<MediaLibraryAsset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameText, setRenameText] = useState('')

  const styles = useMemo(() => makeStyles(colors), [colors])

  useEffect(() => {
    let cancelled = false
    void getAssetIdsForCluster(id).then((ids) => {
      if (cancelled) return
      setAssets(ids.map((aid) => new Asset(aid)))
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [id])

  const rows = useMemo(() => chunkAssets(assets), [assets])
  const allAssetIds = useMemo(() => assets.map((a) => a.id), [assets])

  const personName = cluster?.name ?? null
  const displayName = personName ?? 'Unknown Person'

  function startRename() {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Rename Person',
        undefined,
        (text) => {
          if (text.trim().length > 0) {
            void renamePerson(id, text.trim())
          }
        },
        'plain-text',
        personName ?? '',
      )
    } else {
      setRenameText(personName ?? '')
      setIsRenaming(true)
    }
  }

  function submitRename() {
    const trimmed = renameText.trim()
    if (trimmed.length > 0) {
      void renamePerson(id, trimmed)
    }
    setIsRenaming(false)
  }

  const renderItem = ({ item }: ListRenderItemInfo<PhotoRow>) => (
    <View style={styles.row}>
      {item.assets.map((asset) => (
        <PhotoThumb
          key={asset.id}
          asset={asset}
          isSelected={selectedIds.has(asset.id)}
          allAssetIds={allAssetIds}
          onPress={() => {
            hapticTap()
            router.push({
              pathname: '/photo/[id]',
              params: { id: asset.id, context: 'person', contextId: id },
            })
          }}
          onLongPress={() => {
            selectAll([asset.id])
            setLastSelected(asset.id)
          }}
        />
      ))}
      {item.assets.length < NUM_COLUMNS &&
        Array.from({ length: NUM_COLUMNS - item.assets.length }).map((_, i) => (
          <View key={`empty-${String(i)}`} style={styles.thumbPlaceholder} />
        ))}
    </View>
  )

  return (
    <>
      <Stack.Screen
        options={{
          title: displayName,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerRight: () => (
            <Pressable onPress={startRename} hitSlop={12} style={styles.editBtn}>
              <Ionicons name="pencil-outline" size={20} color={colors.accent} />
            </Pressable>
          ),
        }}
      />

      <View style={[styles.screen, { paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
        {/* Android rename modal */}
        {isRenaming && (
          <View style={styles.renameModal}>
            <View style={[styles.renameCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.renameTitle, { color: colors.text }]}>Rename Person</Text>
              <TextInput
                style={[styles.renameInput, { color: colors.text, borderColor: colors.border }]}
                value={renameText}
                onChangeText={setRenameText}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={submitRename}
                placeholderTextColor={colors.textTertiary}
                placeholder="Enter name"
              />
              <View style={styles.renameActions}>
                <Pressable onPress={() => { setIsRenaming(false) }} style={styles.renameCancelBtn}>
                  <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={submitRename}
                  style={[styles.renameConfirmBtn, { backgroundColor: colors.accent }]}
                >
                  <Text style={styles.renameConfirmText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {isSelecting && <SelectionBar />}

        {isLoading ? (
          <View style={styles.centered}>
            <Text style={[styles.loadingText, { color: colors.textTertiary }]}>Loading…</Text>
          </View>
        ) : assets.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="person-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.loadingText, { color: colors.textTertiary }]}>No photos found</Text>
          </View>
        ) : (
          <FlashList
            data={rows}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={1}
            extraData={selectedIds}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
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
    row: {
      flexDirection: 'row',
    },
    thumbPlaceholder: {
      flex: 1,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 16,
    },
    editBtn: {
      paddingRight: 8,
    },
    renameModal: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    renameCard: {
      width: SCREEN_WIDTH - 64,
      borderRadius: 14,
      padding: 20,
      gap: 12,
    },
    renameTitle: {
      fontSize: 17,
      fontWeight: '600',
    },
    renameInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
    },
    renameActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
    },
    renameCancelBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    renameConfirmBtn: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    renameConfirmText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 15,
    },
  })
}
