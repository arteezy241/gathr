import { useCallback, useEffect, useRef } from 'react'
import { addListener, removeAllListeners, getPhotosByDate } from '@/lib/mediaLibrary'
import { useGalleryStore } from '@/store/galleryStore'
import { useTrashStore } from '@/store/trashStore'

const PAGE_SIZE = 100

interface GalleryResult {
  assets: ReturnType<typeof useGalleryStore.getState>['assets']
  isLoading: boolean
  error: string | null
  hasNextPage: boolean
  loadMore: () => Promise<void>
}

export function useGallery(): GalleryResult {
  const assets = useGalleryStore((s) => s.assets)
  const isLoading = useGalleryStore((s) => s.isLoading)
  const error = useGalleryStore((s) => s.error)
  const hasNextPage = useGalleryStore((s) => s.hasNextPage)
  const endCursor = useGalleryStore((s) => s.endCursor)
  const refreshKey = useGalleryStore((s) => s.refreshKey)

  // Guard against concurrent fetches
  const fetchingRef = useRef(false)

  const fetchPage = useCallback(async (cursor: string | undefined, isInitial: boolean) => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    // Read actions from store directly so this callback has no external deps
    const { setAssets, appendAssets, setLoading, setError, setPagination } =
      useGalleryStore.getState()

    setLoading(true)
    setError(null)

    try {
      const results = await getPhotosByDate(PAGE_SIZE, cursor)

      // Filter out soft-deleted (trashed) assets
      const trashedIds = new Set(useTrashStore.getState().items.map((i) => i.assetId))
      const filtered = trashedIds.size > 0
        ? results.filter((a) => !trashedIds.has(a.id))
        : results

      const offset = cursor !== undefined ? parseInt(cursor, 10) : 0
      const nextCursor = String(offset + results.length)
      const nextHasMore = results.length === PAGE_SIZE

      if (isInitial) {
        setAssets(filtered)
      } else {
        appendAssets(filtered)
      }
      setPagination(nextHasMore, nextHasMore ? nextCursor : undefined)
    } catch (err) {
      const { setError: reportError } = useGalleryStore.getState()
      reportError(err instanceof Error ? err.message : 'Failed to load photos')
    } finally {
      const { setLoading: stopLoading } = useGalleryStore.getState()
      stopLoading(false)
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    void fetchPage(undefined, true)
  }, [fetchPage, refreshKey])

  // Reload the first page whenever the device media library changes (new photo taken, deleted, etc.)
  useEffect(() => {
    const sub = addListener(() => {
      void fetchPage(undefined, true)
    })
    return () => {
      sub.remove()
      removeAllListeners()
    }
  }, [fetchPage])

  const loadMore = useCallback(async () => {
    if (!hasNextPage || isLoading) return
    await fetchPage(endCursor, false)
  }, [hasNextPage, isLoading, endCursor, fetchPage])

  return { assets, isLoading, error, hasNextPage, loadMore }
}
