import { create } from 'zustand'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'

interface GalleryState {
  assets: MediaLibraryAsset[]
  localAssets: MediaLibraryAsset[]  // camera-saved, pending MediaStore indexing
  isLoading: boolean
  error: string | null
  hasNextPage: boolean
  endCursor: string | undefined
  refreshKey: number
  setAssets: (assets: MediaLibraryAsset[]) => void
  appendAssets: (assets: MediaLibraryAsset[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setPagination: (hasNextPage: boolean, endCursor: string | undefined) => void
  removeAssets: (ids: string[]) => void
  prependAssets: (assets: MediaLibraryAsset[]) => void
  invalidate: () => void
}

export const useGalleryStore = create<GalleryState>((set) => ({
  assets: [],
  localAssets: [],
  isLoading: false,
  error: null,
  hasNextPage: false,
  endCursor: undefined,
  refreshKey: 0,

  // Merge fetched assets with any localAssets not yet returned by MediaStore
  setAssets: (fetched) => {
    set((state) => {
      const fetchedIds = new Set(fetched.map((a) => a.id))
      const stillLocal = state.localAssets.filter((a) => !fetchedIds.has(a.id))
      return {
        assets: stillLocal.length > 0 ? [...stillLocal, ...fetched] : fetched,
        localAssets: stillLocal,
      }
    })
  },

  appendAssets: (assets) => {
    set((state) => ({ assets: [...state.assets, ...assets] }))
  },

  setLoading: (loading) => {
    set({ isLoading: loading })
  },

  setError: (error) => {
    set({ error })
  },

  setPagination: (hasNextPage, endCursor) => {
    set({ hasNextPage, endCursor })
  },

  removeAssets: (ids) => {
    const idSet = new Set(ids)
    set((state) => ({
      assets: state.assets.filter((a) => !idSet.has(a.id)),
      localAssets: state.localAssets.filter((a) => !idSet.has(a.id)),
    }))
  },

  // Add to front of gallery and mark as local until MediaStore indexes them
  prependAssets: (newAssets) => {
    set((state) => {
      const existingIds = new Set(state.assets.map((a) => a.id))
      const toAdd = newAssets.filter((a) => !existingIds.has(a.id))
      if (toAdd.length === 0) return {}
      return {
        assets: [...toAdd, ...state.assets],
        localAssets: [...state.localAssets, ...toAdd],
      }
    })
  },

  invalidate: () => { set((state) => ({ refreshKey: state.refreshKey + 1 })) },
}))

export const galleryStore = useGalleryStore
