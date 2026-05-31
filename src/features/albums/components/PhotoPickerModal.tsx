import { useCallback, useMemo, useState } from 'react'
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useGalleryStore } from '@/store/galleryStore'
import { useTheme } from '@/lib/themeContext'
import { radius, spacing, typography, type ThemeColors } from '@/lib/theme'

const NUM_COLS = 3
const GAP = 2
const THUMB = Math.floor((Dimensions.get('window').width - GAP * (NUM_COLS - 1)) / NUM_COLS)

interface Props {
  visible: boolean
  excludeIds: Set<string>
  onClose: () => void
  onConfirm: (ids: string[]) => void
}

function assetUri(id: string): string {
  return Platform.OS === 'ios' ? `ph://${id}` : id
}

export function PhotoPickerModal({ visible, excludeIds, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const assets = useGalleryStore((s) => s.assets)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const styles = useMemo(() => makeStyles(colors), [colors])

  const available = useMemo(
    () => assets.filter((a) => !excludeIds.has(a.id)),
    [assets, excludeIds],
  )

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleConfirm = useCallback(() => {
    onConfirm([...selected])
    setSelected(new Set())
  }, [selected, onConfirm])

  const handleClose = useCallback(() => {
    setSelected(new Set())
    onClose()
  }, [onClose])

  function renderItem({ item }: { item: { id: string } }) {
    const isSelected = selected.has(item.id)
    return (
      <Pressable onPress={() => { toggle(item.id) }} style={styles.thumb}>
        <Image
          source={{ uri: assetUri(item.id) }}
          style={styles.thumbImage}
          contentFit="cover"
          recyclingKey={item.id}
        />
        {isSelected && <View style={styles.selectedOverlay} />}
        <View style={styles.circle}>
          <Ionicons
            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={isSelected ? colors.accent : 'rgba(255,255,255,0.65)'}
          />
        </View>
      </Pressable>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Add Photos</Text>
          <Pressable
            onPress={handleConfirm}
            disabled={selected.size === 0}
            hitSlop={8}
          >
            <Text style={[styles.addText, selected.size === 0 && styles.addTextDisabled]}>
              {selected.size > 0 ? `Add ${String(selected.size)}` : 'Add'}
            </Text>
          </Pressable>
        </View>

        <FlatList
          data={available}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLS}
          renderItem={renderItem}
          columnWrapperStyle={styles.row}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.md }}
          extraData={selected}
        />
      </View>
    </Modal>
  )
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      ...typography.title,
      color: colors.text,
    },
    cancelText: {
      ...typography.body,
      color: colors.accent,
    },
    addText: {
      ...typography.bodyMedium,
      color: colors.accent,
    },
    addTextDisabled: {
      color: colors.textTertiary,
    },
    row: {
      gap: GAP,
      marginBottom: GAP,
    },
    thumb: {
      width: THUMB,
      height: THUMB,
    },
    thumbImage: {
      width: THUMB,
      height: THUMB,
    },
    selectedOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.selectedOverlay,
    },
    circle: {
      position: 'absolute',
      top: 5,
      right: 5,
    },
  })
}
