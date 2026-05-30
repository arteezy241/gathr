import { useEffect } from 'react'
import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Stack } from 'expo-router'
import { usePermissions } from '@/hooks/usePermissions'
import { useGalleryStore } from '@/store/galleryStore'
import { useSelectionStore } from '@/store/selectionStore'
import { useTripStore } from '@/store/tripStore'
import { PhotoGrid } from '@/features/gallery/components/PhotoGrid'
import { SelectionBar } from '@/features/gallery/components/SelectionBar'
import { TripsSection } from '@/features/gallery/components/TripsSection'
import { theme } from '@/lib/theme'

export default function GalleryScreen() {
  const { granted, requesting, request } = usePermissions()
  const isSelecting = useSelectionStore((s) => s.isSelecting)
  const selectedIds = useSelectionStore((s) => s.selectedIds)
  const clearSelection = useSelectionStore((s) => s.clearSelection)
  const assets = useGalleryStore((s) => s.assets)
  const { lastGroupedAt, detectAndSaveTrips } = useTripStore()

  const selectedCount = selectedIds.size

  useEffect(() => {
    if (assets.length > 0 && lastGroupedAt === null) {
      void detectAndSaveTrips(assets)
    }
  }, [assets, lastGroupedAt, detectAndSaveTrips])

  if (requesting) {
    return (
      <>
        <Stack.Screen options={{ title: 'Gathr' }} />
        <View style={styles.centered} />
      </>
    )
  }

  if (!granted) {
    return (
      <>
        <Stack.Screen options={{ title: 'Gathr' }} />
        <View style={styles.centered}>
          <Text style={styles.permissionTitle}>Photo Access Required</Text>
          <Text style={styles.permissionBody}>
            Gathr needs access to your photo library to display and organize your photos.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={() => { void request() }}>
            <Text style={styles.permissionButtonText}>Allow Access</Text>
          </TouchableOpacity>
        </View>
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={
          isSelecting
            ? {
                title: `${String(selectedCount)} selected`,
                headerRight: () => (
                  <Button title="Cancel" onPress={clearSelection} />
                ),
              }
            : { title: 'Gathr' }
        }
      />
      <View style={styles.screen}>
        <PhotoGrid listHeader={<TripsSection />} />
        <SelectionBar />
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  permissionTitle: {
    ...theme.typography.headline,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  permissionBody: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  permissionButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
  },
  permissionButtonText: {
    color: theme.colors.text,
    ...theme.typography.title,
  },
})
