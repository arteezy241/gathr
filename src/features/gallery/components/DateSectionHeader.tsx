import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSelectionStore } from '@/store/selectionStore'
import { impactLight } from '@/lib/haptics'

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
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleFilled: {
    backgroundColor: '#007AFF',
  },
  circleEmpty: {
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    backgroundColor: 'transparent',
  },
  checkmark: {
    width: 10,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#ffffff',
    transform: [{ rotate: '-45deg' }, { translateY: -1 }],
  },
  dash: {
    width: 10,
    height: 2,
    backgroundColor: '#007AFF',
    borderRadius: 1,
  },
})
