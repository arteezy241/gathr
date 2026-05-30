import { create } from 'zustand'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'
import { groupAssetsIntoTrips } from '@/lib/tripGrouper'
import { type StoredTrip, clearTrips, getTrips, saveTrips } from '@/lib/db'

type TripState = {
  trips: StoredTrip[]
  isLoading: boolean
  lastGroupedAt: number | null
  error: string | null
}

type TripActions = {
  loadTrips: () => Promise<void>
  detectAndSaveTrips: (assets: MediaLibraryAsset[]) => Promise<void>
  clearAllTrips: () => Promise<void>
}

export const useTripStore = create<TripState & TripActions>((set) => ({
  trips: [],
  isLoading: false,
  lastGroupedAt: null,
  error: null,

  loadTrips: async () => {
    set({ isLoading: true, error: null })
    try {
      const trips = await getTrips()
      set({ trips, isLoading: false })
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Failed to load trips' })
    }
  },

  detectAndSaveTrips: async (assets: MediaLibraryAsset[]) => {
    set({ isLoading: true, error: null })
    try {
      const groups = await groupAssetsIntoTrips(assets)
      await saveTrips(groups)
      const trips = await getTrips()
      set({ trips, isLoading: false, lastGroupedAt: Date.now() })
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Failed to detect trips' })
    }
  },

  clearAllTrips: async () => {
    set({ isLoading: true, error: null })
    try {
      await clearTrips()
      set({ trips: [], isLoading: false, lastGroupedAt: null })
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Failed to clear trips' })
    }
  },
}))
