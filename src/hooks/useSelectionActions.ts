import { useState } from 'react'
import { useSelectionStore } from '@/store/selectionStore'
import { useGalleryStore } from '@/store/galleryStore'
import { useAlbumStore } from '@/store/albumStore'
import { useTrashStore } from '@/store/trashStore'
import { shareMultipleAssets } from '@/lib/sharing'
import { exportAssetsAsZip, type ExportProgress } from '@/lib/exportZip'
import { hapticTap, hapticSuccess, hapticWarning } from '@/lib/haptics'
import { useUndoToast } from '@/components/ui/UndoToast'
import { useSheet } from '@/components/ui/SheetProvider'

export function useSelectionActions() {
  const selectedIds = useSelectionStore((s) => s.selectedIds)
  const clearSelection = useSelectionStore((s) => s.clearSelection)
  const assets = useGalleryStore((s) => s.assets)
  const removeAssets = useGalleryStore((s) => s.removeAssets)
  const { albums, loadAlbums, addAssetsToAlbum } = useAlbumStore()
  const { showToast } = useUndoToast()
  const { showInfo, showSheet } = useSheet()

  const [isSharing, setIsSharing] = useState(false)
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)

  const selected = assets.filter((a) => selectedIds.has(a.id))

  async function handleShare(): Promise<void> {
    if (isSharing || selected.length === 0) return
    if (selected.length > 1) {
      showInfo('Share Multiple Photos', 'Tap the export button to share all selected photos as a ZIP file.')
      return
    }
    hapticTap()
    setIsSharing(true)
    try {
      await shareMultipleAssets(selected)
    } catch (e) {
      showInfo('Share Failed', e instanceof Error ? e.message : 'An error occurred.')
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
      showInfo('Export Failed', e instanceof Error ? e.message : 'Could not export photos.')
    } finally {
      setExportProgress(null)
    }
  }

  function handleAddToAlbum(): void {
    hapticTap()
    void loadAlbums()
    const publicAlbums = albums.filter((a) => !a.isPrivate)
    if (publicAlbums.length === 0) {
      showInfo('No Albums', 'Create an album first before adding photos.')
      return
    }
    showSheet({
      title: 'Add to Album',
      actions: publicAlbums.map((album) => ({
        label: album.name,
        onPress: () => {
          void (async () => {
            await addAssetsToAlbum(album.id, [...selectedIds])
            hapticSuccess()
            clearSelection()
            showInfo('Added', `Added to ${album.name}`)
          })()
        },
      })),
    })
  }

  function handleDelete(): void {
    const toDelete = selected
    if (toDelete.length === 0) return
    hapticWarning()
    const ids = toDelete.map((a) => a.id)
    void (async () => {
      try {
        await Promise.all(ids.map((id) => useTrashStore.getState().moveToTrash(id)))
        removeAssets(ids)
        clearSelection()
        const count = ids.length
        const label = `${String(count)} ${count === 1 ? 'photo' : 'photos'} moved to Trash`
        showToast(label, () => {
          void Promise.all(ids.map((id) => useTrashStore.getState().restoreFromTrash(id)))
        })
      } catch (e) {
        showInfo('Error', e instanceof Error ? e.message : 'Could not move photos to Trash.')
      }
    })()
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
