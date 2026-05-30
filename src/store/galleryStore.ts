import { create } from 'zustand'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'

interface GalleryState {
  assets: MediaLibraryAsset[]
  isLoading: boolean
  error: string | null
  hasNextPage: boolean
  endCursor: string | undefined
  setAssets: (assets: MediaLibraryAsset[]) => void
  appendAssets: (assets: MediaLibraryAsset[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setPagination: (hasNextPage: boolean, endCursor: string | undefined) => void
}

export const useGalleryStore = create<GalleryState>((set) => ({
  assets: [],
  isLoading: false,
  error: null,
  hasNextPage: false,
  endCursor: undefined,

  setAssets: (assets) => {
    set({ assets })
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
}))

export const galleryStore = useGalleryStore
