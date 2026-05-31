import { create } from 'zustand'
import { type StoredTrip } from '@/lib/db'
import { type Memory, buildMemories } from '@/lib/memories'
import { scheduleDailyMemoryReminder } from '@/lib/notifications'

type MemoriesState = {
  memories: Memory[]
  isLoading: boolean
  loadedAt: number | null
}

type MemoriesActions = {
  load: (trips: StoredTrip[]) => Promise<void>
}

export const useMemoriesStore = create<MemoriesState & MemoriesActions>((set) => ({
  memories: [],
  isLoading: false,
  loadedAt: null,

  load: async (trips) => {
    set({ isLoading: true })
    try {
      const memories = await buildMemories(trips)
      set({ memories, isLoading: false, loadedAt: Date.now() })
      // Schedule (or re-schedule) the daily reminder whenever memories exist
      if (memories.length > 0) {
        void scheduleDailyMemoryReminder()
      }
    } catch {
      set({ isLoading: false })
    }
  },
}))
