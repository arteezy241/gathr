import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSelectionStore } from '@/store/selectionStore'
import { hapticToggle } from '@/lib/haptics'
import { useTheme } from '@/lib/themeContext'
import { spacing, typography, type ThemeColors } from '@/lib/theme'

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
  const { colors } = useTheme()
  const isSelecting = useSelectionStore((s) => s.isSelecting)
  const selectAll = useSelectionStore((s) => s.selectAll)
  const selectedIds = useSelectionStore((s) => s.selectedIds)
  const toggleSelect = useSelectionStore((s) => s.toggleSelect)

  const styles = useMemo(() => makeStyles(colors), [colors])

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
          {showPartial && <View style={[styles.dash, { backgroundColor: colors.accent }]} />}
        </Pressable>
      )}
    </View>
  )
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: spacing.sm,
      backgroundColor: colors.background,
    },
    label: {
      ...typography.bodyMedium,
      color: colors.text,
    },
    circle: {
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      borderRadius: BORDER_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleFilled: {
      backgroundColor: colors.accent,
    },
    circleEmpty: {
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: 'transparent',
    },
    checkmark: {
      width: 10,
      height: 6,
      borderLeftWidth: 2,
      borderBottomWidth: 2,
      borderColor: '#FFFFFF',
      transform: [{ rotate: '-45deg' }, { translateY: -1 }],
    },
    dash: {
      width: 10,
      height: 2,
      borderRadius: 1,
    },
  })
}
