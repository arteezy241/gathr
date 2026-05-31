import { create } from 'zustand'
import { addFavorite, getFavoriteIds, removeFavorite } from '@/lib/db'

interface FavoriteState {
  favoriteIds: Set<string>
  loadFavorites: () => Promise<void>
  toggleFavorite: (assetId: string) => Promise<void>
  isFavorited: (assetId: string) => boolean
}

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  favoriteIds: new Set(),

  loadFavorites: async () => {
    const ids = await getFavoriteIds()
    set({ favoriteIds: new Set(ids) })
  },

  toggleFavorite: async (assetId) => {
    const { favoriteIds } = get()
    if (favoriteIds.has(assetId)) {
      await removeFavorite(assetId)
      set((s) => {
        const next = new Set(s.favoriteIds)
        next.delete(assetId)
        return { favoriteIds: next }
      })
    } else {
      await addFavorite(assetId)
      set((s) => ({ favoriteIds: new Set(s.favoriteIds).add(assetId) }))
    }
  },

  isFavorited: (assetId) => get().favoriteIds.has(assetId),
}))
