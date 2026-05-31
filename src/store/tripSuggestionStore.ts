import { create } from 'zustand'
import { type StoredTrip, createAlbum, addAssetsToAlbum, updateAlbumCover, getDismissedTripIds, dismissTripSuggestion } from '@/lib/db'
import { getPhotosByDateRange } from '@/lib/mediaLibrary'
import { useAlbumStore } from '@/store/albumStore'

export type TripSuggestion = {
  trip: StoredTrip
}

type State = {
  suggestions: TripSuggestion[]
  saving: string | null  // trip ID currently being saved
}

type Actions = {
  loadSuggestions: (trips: StoredTrip[]) => Promise<void>
  saveSuggestionAsAlbum: (suggestion: TripSuggestion) => Promise<void>
  dismiss: (tripId: string) => Promise<void>
}

export const useTripSuggestionStore = create<State & Actions>((set, get) => ({
  suggestions: [],
  saving: null,

  loadSuggestions: async (trips) => {
    const dismissed = await getDismissedTripIds()
    const suggestions = trips
      .filter((t) => !dismissed.has(t.id))
      .map((trip) => ({ trip }))
    set({ suggestions })
  },

  saveSuggestionAsAlbum: async (suggestion) => {
    const { trip } = suggestion
    set({ saving: trip.id })
    try {
      // Create the album
      const albumId = await createAlbum(trip.label, false)

      // Fetch all photos within the trip's date range
      const photos = await getPhotosByDateRange(trip.startDate, trip.endDate, 500)
      const assetIds = photos.map((p) => p.id)

      if (assetIds.length > 0) {
        await addAssetsToAlbum(albumId, assetIds)
      }

      // Set cover to the trip's cover asset
      await updateAlbumCover(albumId, trip.coverAssetId)

      // Refresh album store so the new album appears immediately
      await useAlbumStore.getState().loadAlbums()

      // Dismiss so it never re-appears
      await dismissTripSuggestion(trip.id)
      set((s) => ({
        saving: null,
        suggestions: s.suggestions.filter((sg) => sg.trip.id !== trip.id),
      }))
    } catch {
      set({ saving: null })
    }
  },

  dismiss: async (tripId) => {
    await dismissTripSuggestion(tripId)
    set((s) => ({
      suggestions: s.suggestions.filter((sg) => sg.trip.id !== tripId),
    }))
  },
}))
