import { create } from 'zustand'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'

async function resolvedDateString(asset: MediaLibraryAsset): Promise<string | null> {
  const ms = await asset.getCreationTime()
  if (ms === null) return null
  return new Date(ms).toISOString().slice(0, 10)
}

async function resolvedYearMonth(asset: MediaLibraryAsset): Promise<string | null> {
  const ms = await asset.getCreationTime()
  if (ms === null) return null
  return new Date(ms).toISOString().slice(0, 7)
}

interface SelectionState {
  selectedIds: Set<string>
  isSelecting: boolean
  lastSelectedId: string | null
  startSelecting: () => void
  toggleSelect: (id: string) => void
  rangeSelect: (ids: string[]) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
  setLastSelected: (id: string) => void
  selectRange: (allIds: string[], fromId: string, toId: string) => void
  selectByDate: (assets: MediaLibraryAsset[], date: string) => Promise<void>
  selectByMonth: (assets: MediaLibraryAsset[], yearMonth: string) => Promise<void>
  deselectByDate: (assets: MediaLibraryAsset[], date: string) => Promise<void>
  getSelectedCount: () => number
}

const initialState = {
  selectedIds: new Set<string>(),
  isSelecting: false,
  lastSelectedId: null,
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  ...initialState,

  startSelecting: () => {
    set({ isSelecting: true })
  },

  toggleSelect: (id) => {
    set((state) => {
      const selectedIds = new Set(state.selectedIds)
      if (selectedIds.has(id)) {
        selectedIds.delete(id)
      } else {
        selectedIds.add(id)
      }
      return { selectedIds, isSelecting: selectedIds.size > 0 }
    })
  },

  rangeSelect: (ids) => {
    set((state) => {
      const selectedIds = new Set(state.selectedIds)
      for (const id of ids) {
        selectedIds.add(id)
      }
      return { selectedIds, isSelecting: selectedIds.size > 0 }
    })
  },

  selectAll: (ids) => {
    set(() => ({
      selectedIds: new Set(ids),
      isSelecting: ids.length > 0,
    }))
  },

  clearSelection: () => {
    set({ ...initialState, selectedIds: new Set<string>() })
  },

  setLastSelected: (id) => {
    set({ lastSelectedId: id })
  },

  selectRange: (allIds, fromId, toId) => {
    set((state) => {
      const fromIndex = allIds.indexOf(fromId)
      const toIndex = allIds.indexOf(toId)
      if (fromIndex === -1 || toIndex === -1) return {}
      const start = Math.min(fromIndex, toIndex)
      const end = Math.max(fromIndex, toIndex)
      const selectedIds = new Set(state.selectedIds)
      for (let i = start; i <= end; i++) {
        const id = allIds[i]
        if (id !== undefined) selectedIds.add(id)
      }
      return { selectedIds, isSelecting: selectedIds.size > 0 }
    })
  },

  selectByDate: async (assets, date) => {
    const matches = await Promise.all(
      assets.map(async (a) => ({ id: a.id, match: (await resolvedDateString(a)) === date })),
    )
    set((state) => {
      const selectedIds = new Set(state.selectedIds)
      for (const { id, match } of matches) {
        if (match) selectedIds.add(id)
      }
      return { selectedIds, isSelecting: selectedIds.size > 0 }
    })
  },

  selectByMonth: async (assets, yearMonth) => {
    const matches = await Promise.all(
      assets.map(async (a) => ({ id: a.id, match: (await resolvedYearMonth(a)) === yearMonth })),
    )
    set((state) => {
      const selectedIds = new Set(state.selectedIds)
      for (const { id, match } of matches) {
        if (match) selectedIds.add(id)
      }
      return { selectedIds, isSelecting: selectedIds.size > 0 }
    })
  },

  deselectByDate: async (assets, date) => {
    const matches = await Promise.all(
      assets.map(async (a) => ({ id: a.id, match: (await resolvedDateString(a)) === date })),
    )
    set((state) => {
      const selectedIds = new Set(state.selectedIds)
      for (const { id, match } of matches) {
        if (match) selectedIds.delete(id)
      }
      return { selectedIds, isSelecting: selectedIds.size > 0 }
    })
  },

  getSelectedCount: () => get().selectedIds.size,
}))

export const selectionStore = useSelectionStore
