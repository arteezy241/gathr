import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Stack } from 'expo-router'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { type MediaLibraryAsset as Asset } from '@/lib/mediaLibrary'
import { useDuplicateStore } from '@/store/duplicateStore'
import { type DuplicateGroup } from '@/lib/duplicateDetector'
import { useTheme } from '@/lib/themeContext'
import { radius, spacing, typography, type ThemeColors } from '@/lib/theme'

const SCREEN_WIDTH = Dimensions.get('window').width
const THUMB_SIZE = Math.floor((SCREEN_WIDTH - 32 - 8 * 2) / 3)

function assetUri(asset: Asset): string {
  return Platform.OS === 'ios' ? `ph://${asset.id}` : asset.id
}

interface GroupCardProps {
  group: DuplicateGroup
  colors: ThemeColors
  onDeleteSelected: (groupId: string, toDelete: Asset[]) => void
  onDismiss: (groupId: string) => void
}

function GroupCard({ group, colors, onDeleteSelected, onDismiss }: GroupCardProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  function handleDelete() {
    const toDelete = group.assets.filter((a) => selected.has(a.id))
    if (toDelete.length === 0) return
    const kept = group.assets.length - toDelete.length
    if (kept === 0) {
      Alert.alert('Keep at least one', 'Select the photos you want to delete, not all of them.')
      return
    }
    Alert.alert(
      `Delete ${String(toDelete.length)} photo${toDelete.length === 1 ? '' : 's'}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => { onDeleteSelected(group.id, toDelete) },
        },
      ],
    )
  }

  const cardStyles = useMemo(() => makeCardStyles(colors), [colors])

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.thumbRow}>
        {group.assets.map((asset, idx) => {
          const isSuggested = idx === group.suggestedKeepIndex
          const isSelected = selected.has(asset.id)
          return (
            <Pressable key={asset.id} onPress={() => { toggle(asset.id) }} style={cardStyles.thumbWrap}>
              <Image
                source={{ uri: assetUri(asset) }}
                style={cardStyles.thumb}
                contentFit="cover"
                recyclingKey={asset.id}
                transition={80}
              />
              {isSuggested && !isSelected && (
                <View style={cardStyles.suggestedBadge}>
                  <Text style={cardStyles.suggestedText}>Keep</Text>
                </View>
              )}
              {isSelected && (
                <View style={cardStyles.selectedOverlay}>
                  <Ionicons name="trash" size={22} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
          )
        })}
      </View>

      <View style={cardStyles.actions}>
        <Text style={cardStyles.countText}>
          {group.assets.length} similar photos
          {selected.size > 0 ? ` · ${String(selected.size)} selected` : ''}
        </Text>
        <View style={cardStyles.buttons}>
          <Pressable onPress={() => { onDismiss(group.id) }} style={cardStyles.dismissBtn} hitSlop={8}>
            <Text style={cardStyles.dismissText}>Dismiss</Text>
          </Pressable>
          {selected.size > 0 && (
            <Pressable onPress={handleDelete} style={cardStyles.deleteBtn}>
              <Text style={cardStyles.deleteBtnText}>Delete {String(selected.size)}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  )
}

export default function DuplicatesScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { groups, isScanning, scanProgress, scannedAt, scan, deleteFromGroup, dismissGroup } =
    useDuplicateStore()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const handleDeleteSelected = useCallback(
    (groupId: string, toDelete: Asset[]) => {
      void deleteFromGroup(groupId, toDelete)
    },
    [deleteFromGroup],
  )

  const handleDismiss = useCallback(
    (groupId: string) => { dismissGroup(groupId) },
    [dismissGroup],
  )

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Similar Photos',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />
      <View style={[styles.screen, { paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
        {scannedAt === null && !isScanning ? (
          <View style={styles.centered}>
            <Ionicons name="copy-outline" size={56} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>Find Similar Photos</Text>
            <Text style={styles.emptyBody}>
              Scan your library for burst shots and near-duplicate photos you can clean up.
            </Text>
            <Pressable style={styles.scanBtn} onPress={() => { void scan() }}>
              <Text style={styles.scanBtnText}>Scan Library</Text>
            </Pressable>
          </View>
        ) : isScanning ? (
          <View style={styles.centered}>
            <Ionicons name="search-outline" size={48} color={colors.accent} />
            <Text style={styles.emptyTitle}>Scanning…</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${String(Math.round(scanProgress))}%` as `${number}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{String(Math.round(scanProgress))}%</Text>
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="checkmark-circle-outline" size={56} color={colors.accentGreen} />
            <Text style={styles.emptyTitle}>No Duplicates Found</Text>
            <Text style={styles.emptyBody}>Your library looks clean!</Text>
            <Pressable style={styles.scanBtn} onPress={() => { void scan() }}>
              <Text style={styles.scanBtnText}>Scan Again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                {String(groups.length)} group{groups.length === 1 ? '' : 's'} found
              </Text>
              <Pressable onPress={() => { void scan() }} hitSlop={8}>
                <Text style={[styles.summaryText, { color: colors.accent }]}>Rescan</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}>
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  colors={colors}
                  onDeleteSelected={handleDeleteSelected}
                  onDismiss={handleDismiss}
                />
              ))}
            </ScrollView>
          </>
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
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: 12,
    },
    emptyTitle: {
      ...typography.headline,
      color: colors.text,
      textAlign: 'center',
    },
    emptyBody: {
      ...typography.body,
      color: colors.textTertiary,
      textAlign: 'center',
      lineHeight: 22,
    },
    scanBtn: {
      marginTop: 8,
      backgroundColor: colors.accent,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 12,
    },
    scanBtnText: {
      color: '#FFFFFF',
      ...typography.title,
    },
    progressBar: {
      width: '70%',
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceElevated,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.accent,
      borderRadius: 3,
    },
    progressLabel: {
      ...typography.caption,
      color: colors.textTertiary,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    summaryText: {
      ...typography.body,
      color: colors.textSecondary,
    },
    list: {
      padding: 16,
      gap: 16,
    },
  })
}

function makeCardStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 3,
    },
    thumbRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 2,
      padding: 2,
    },
    thumbWrap: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      position: 'relative',
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
    },
    suggestedBadge: {
      position: 'absolute',
      bottom: 4,
      left: 4,
      backgroundColor: colors.accentGreen,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    suggestedText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    selectedOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(255,59,48,0.65)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    countText: {
      ...typography.caption,
      color: colors.textTertiary,
    },
    buttons: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    dismissBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    dismissText: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    deleteBtn: {
      backgroundColor: colors.accentRed,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    deleteBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  })
}
