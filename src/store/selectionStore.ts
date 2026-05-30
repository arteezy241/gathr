import { create } from 'zustand'

interface SelectionState {
  selectedIds: Set<string>
  isSelecting: boolean
  lastSelectedId: string | null
  toggleSelect: (id: string) => void
  rangeSelect: (ids: string[]) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
  setLastSelected: (id: string) => void
}

const initialState = {
  selectedIds: new Set<string>(),
  isSelecting: false,
  lastSelectedId: null,
}

export const useSelectionStore = create<SelectionState>((set) => ({
  ...initialState,

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
}))

export const selectionStore = useSelectionStore
