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
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: 15,
    color: '#6C6C70',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
})
