import { Platform } from 'react-native'
import { create } from 'zustand'
import {
  addToTrash,
  removeFromTrash,
  getAllTrash,
  purgeExpiredTrash,
  clearTrash,
  type TrashRow,
} from '@/lib/db'
import { permanentlyDeleteByIds } from '@/lib/mediaLibrary'
import { useGalleryStore } from '@/store/galleryStore'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export interface TrashItem {
  assetId: string
  uri: string
  deletedAt: number
  daysRemaining: number
}

interface TrashState {
  items: TrashItem[]
  isLoading: boolean
}

interface TrashActions {
  loadTrash: () => Promise<void>
  moveToTrash: (assetId: string) => Promise<void>
  restoreFromTrash: (assetId: string) => Promise<void>
  permanentlyDelete: (assetId: string) => Promise<void>
  emptyTrash: () => Promise<void>
  purgeExpired: () => Promise<void>
}

function uriFromId(assetId: string): string {
  return Platform.OS === 'ios' ? `ph://${assetId}` : assetId
}

function rowToItem(row: TrashRow): TrashItem {
  const daysSince = Math.floor((Date.now() - row.deleted_at) / (24 * 60 * 60 * 1000))
  return {
    assetId: row.asset_id,
    uri: row.original_uri,
    deletedAt: row.deleted_at,
    daysRemaining: Math.max(0, 30 - daysSince),
  }
}

export const useTrashStore = create<TrashState & TrashActions>((set, get) => ({
  items: [],
  isLoading: false,

  loadTrash: async () => {
    set({ isLoading: true })
    try {
      const rows = await getAllTrash()
      set({ items: rows.map(rowToItem), isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  moveToTrash: async (assetId) => {
    const uri = uriFromId(assetId)
    const deletedAt = Date.now()
    await addToTrash(assetId, uri)
    const newItem: TrashItem = {
      assetId,
      uri,
      deletedAt,
      daysRemaining: 30,
    }
    set((s) => ({ items: [newItem, ...s.items] }))
  },

  restoreFromTrash: async (assetId) => {
    await removeFromTrash(assetId)
    set((s) => ({ items: s.items.filter((i) => i.assetId !== assetId) }))
    useGalleryStore.getState().invalidate()
  },

  permanentlyDelete: async (assetId) => {
    await permanentlyDeleteByIds([assetId])
    await removeFromTrash(assetId)
    set((s) => ({ items: s.items.filter((i) => i.assetId !== assetId) }))
  },

  emptyTrash: async () => {
    const ids = get().items.map((i) => i.assetId)
    if (ids.length === 0) return
    await permanentlyDeleteByIds(ids)
    await clearTrash()
    set({ items: [] })
  },

  purgeExpired: async () => {
    const cutoff = Date.now() - THIRTY_DAYS_MS
    const expiredIds = await purgeExpiredTrash(cutoff)
    if (expiredIds.length === 0) return
    await permanentlyDeleteByIds(expiredIds)
    const expiredSet = new Set(expiredIds)
    set((s) => ({ items: s.items.filter((i) => !expiredSet.has(i.assetId)) }))
  },
}))
