import { create } from 'zustand'
import { type DuplicateGroup, scanForDuplicates } from '@/lib/duplicateDetector'
import { deleteAssets } from '@/lib/mediaLibrary'
import { type Asset } from 'expo-media-library/next'

type DuplicateState = {
  groups: DuplicateGroup[]
  isScanning: boolean
  scanProgress: number
  scannedAt: number | null
}

type DuplicateActions = {
  scan: () => Promise<void>
  deleteFromGroup: (groupId: string, assetsToDelete: Asset[]) => Promise<void>
  dismissGroup: (groupId: string) => void
}

export const useDuplicateStore = create<DuplicateState & DuplicateActions>((set, get) => ({
  groups: [],
  isScanning: false,
  scanProgress: 0,
  scannedAt: null,

  scan: async () => {
    set({ isScanning: true, scanProgress: 0 })
    try {
      const groups = await scanForDuplicates((pct) => {
        set({ scanProgress: pct })
      })
      set({ groups, isScanning: false, scanProgress: 100, scannedAt: Date.now() })
    } catch {
      set({ isScanning: false })
    }
  },

  deleteFromGroup: async (groupId, assetsToDelete) => {
    await deleteAssets(assetsToDelete)
    const groups = get().groups
      .map((g) => {
        if (g.id !== groupId) return g
        const remaining = g.assets.filter((a) => !assetsToDelete.some((d) => d.id === a.id))
        if (remaining.length < 2) return null
        const midIndex = Math.floor(remaining.length / 2)
        return { ...g, assets: remaining, suggestedKeepIndex: midIndex }
      })
      .filter((g): g is DuplicateGroup => g !== null)
    set({ groups })
  },

  dismissGroup: (groupId) => {
    set({ groups: get().groups.filter((g) => g.id !== groupId) })
  },
}))
