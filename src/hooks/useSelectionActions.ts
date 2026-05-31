import { useState } from 'react'
import { Alert } from 'react-native'
import { useSelectionStore } from '@/store/selectionStore'
import { useGalleryStore } from '@/store/galleryStore'
import { useAlbumStore } from '@/store/albumStore'
import { deleteAssets } from '@/lib/mediaLibrary'
import { shareMultipleAssets } from '@/lib/sharing'
import { exportAssetsAsZip, type ExportProgress } from '@/lib/exportZip'
import { hapticTap, hapticSuccess, hapticWarning, hapticDelete } from '@/lib/haptics'

export function useSelectionActions() {
  const selectedIds = useSelectionStore((s) => s.selectedIds)
  const clearSelection = useSelectionStore((s) => s.clearSelection)
  const assets = useGalleryStore((s) => s.assets)
  const removeAssets = useGalleryStore((s) => s.removeAssets)
  const { albums, loadAlbums, addAssetsToAlbum } = useAlbumStore()

  const [isSharing, setIsSharing] = useState(false)
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)

  const selected = assets.filter((a) => selectedIds.has(a.id))

  async function handleShare(): Promise<void> {
    if (isSharing || selected.length === 0) return
    if (selected.length > 1) {
      Alert.alert(
        'Share Multiple Photos',
        'Tap the export button to share all selected photos as a ZIP file.',
        [{ text: 'OK' }],
      )
      return
    }
    hapticTap()
    setIsSharing(true)
    try {
      await shareMultipleAssets(selected)
    } catch (e) {
      Alert.alert('Share Failed', e instanceof Error ? e.message : 'An error occurred.')
    } finally {
      setIsSharing(false)
    }
  }

  async function handleExport(): Promise<void> {
    if (selected.length === 0 || exportProgress !== null) return
    hapticTap()
    try {
      await exportAssetsAsZip(selected, (p) => { setExportProgress(p) })
      hapticSuccess()
    } catch (e) {
      Alert.alert('Export Failed', e instanceof Error ? e.message : 'Could not export photos.')
    } finally {
      setExportProgress(null)
    }
  }

  function handleAddToAlbum(): void {
    hapticTap()
    void loadAlbums()
    const publicAlbums = albums.filter((a) => !a.isPrivate)
    if (publicAlbums.length === 0) {
      Alert.alert('No Albums', 'Create an album first before adding photos.')
      return
    }
    Alert.alert(
      'Add to Album',
      'Choose an album',
      [
        ...publicAlbums.map((album) => ({
          text: album.name,
          onPress: () => {
            void (async () => {
              await addAssetsToAlbum(album.id, [...selectedIds])
              hapticSuccess()
              clearSelection()
              Alert.alert('Added', `Added to ${album.name}`)
            })()
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    )
  }

  function handleDelete(): void {
    const toDelete = selected
    if (toDelete.length === 0) return
    hapticWarning()
    Alert.alert(
      'Delete Photos',
      `Delete ${String(toDelete.length)} photo${toDelete.length === 1 ? '' : 's'}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await hapticDelete()
                await deleteAssets(toDelete)
                removeAssets(toDelete.map((a) => a.id))
                clearSelection()
              } catch (e) {
                Alert.alert('Delete Failed', e instanceof Error ? e.message : 'Could not delete photos.')
              }
            })()
          },
        },
      ],
    )
  }

  return {
    isSharing,
    exportProgress,
    handleShare,
    handleExport,
    handleAddToAlbum,
    handleDelete,
  }
}
