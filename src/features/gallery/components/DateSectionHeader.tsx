import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSelectionStore } from '@/store/selectionStore'
import { impactLight } from '@/lib/haptics'
import { theme } from '@/lib/theme'

interface Props {
  label: string
  date: string
  assetIds: string[]
  isAllSelected: boolean
  isPartiallySelected: boolean
}

const CIRCLE_SIZE = 24
const BORDER_RADIUS = CIRCLE_SIZE / 2

export function DateSectionHeader({ label, date, assetIds, isAllSelected, isPartiallySelected }: Props) {
  const isSelecting = useSelectionStore((s) => s.isSelecting)
  const selectAll = useSelectionStore((s) => s.selectAll)
  const selectedIds = useSelectionStore((s) => s.selectedIds)
  const toggleSelect = useSelectionStore((s) => s.toggleSelect)

  function handleCirclePress() {
    void impactLight()
    if (isAllSelected) {
      for (const id of assetIds) {
        if (selectedIds.has(id)) toggleSelect(id)
      }
    } else {
      const current = useSelectionStore.getState().selectedIds
      const merged = [...current, ...assetIds.filter((id) => !current.has(id))]
      selectAll(merged)
    }
  }

  const showFilled = isAllSelected
  const showPartial = isPartiallySelected && !isAllSelected

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {isSelecting && (
        <Pressable
          onPress={handleCirclePress}
          style={[styles.circle, showFilled ? styles.circleFilled : styles.circleEmpty]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isAllSelected ? true : isPartiallySelected ? 'mixed' : false }}
          accessibilityLabel={`Select all photos from ${date}`}
          hitSlop={8}
        >
          {showFilled && <View style={styles.checkmark} />}
          {showPartial && <View style={styles.dash} />}
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm + 4,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  label: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleFilled: {
    backgroundColor: theme.colors.accent,
  },
  circleEmpty: {
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
  },
  checkmark: {
    width: 10,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: theme.colors.text,
    transform: [{ rotate: '-45deg' }, { translateY: -1 }],
  },
  dash: {
    width: 10,
    height: 2,
    backgroundColor: theme.colors.accent,
    borderRadius: 1,
  },
})
