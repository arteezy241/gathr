import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSelectionStore } from '@/store/selectionStore'
import { hapticToggle } from '@/lib/haptics'
import { useTheme } from '@/lib/themeContext'

interface Props {
  label: string
  date: string
  assetIds: string[]
  isAllSelected: boolean
  isPartiallySelected: boolean
}

export function DateSectionHeader({ label, date, assetIds, isAllSelected, isPartiallySelected }: Props) {
  const { colors } = useTheme()
  const isSelecting = useSelectionStore((s) => s.isSelecting)
  const selectAll = useSelectionStore((s) => s.selectAll)
  const selectedIds = useSelectionStore((s) => s.selectedIds)
  const toggleSelect = useSelectionStore((s) => s.toggleSelect)

  if (!isSelecting) return <View style={{ height: 0 }} />

  function handleCirclePress() {
    hapticToggle()
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

  const showPartial = isPartiallySelected && !isAllSelected

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={handleCirclePress}
        style={[
          styles.circle,
          {
            backgroundColor: isAllSelected ? colors.accent : 'transparent',
            borderColor: isAllSelected ? colors.accent : 'rgba(255,255,255,0.30)',
          },
        ]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isAllSelected ? true : isPartiallySelected ? 'mixed' : false }}
        accessibilityLabel={`Select all photos from ${date}`}
        hitSlop={8}
      >
        {isAllSelected && <View style={styles.checkmark} />}
        {showPartial && <View style={[styles.dash, { backgroundColor: colors.accent }]} />}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.60)',
    letterSpacing: 0.1,
  },
  circle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    width: 8,
    height: 5,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }, { translateY: -1 }],
  },
  dash: {
    width: 8,
    height: 1.5,
    borderRadius: 1,
  },
})
