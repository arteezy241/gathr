import { create } from 'zustand'
import {
  type Album,
  addAssetsToAlbum as dbAddAssets,
  createAlbum,
  deleteAlbum,
  getAlbums,
  removeAssetsFromAlbum as dbRemoveAssets,
} from '@/lib/db'

interface AlbumState {
  albums: Album[]
  isLoading: boolean
  error: string | null
  loadAlbums: () => Promise<void>
  addAlbum: (name: string, isPrivate: boolean) => Promise<string>
  removeAlbum: (id: string) => Promise<void>
  addAssetsToAlbum: (albumId: string, assetIds: string[]) => Promise<void>
  removeAssetsFromAlbum: (albumId: string, assetIds: string[]) => Promise<void>
}

export const useAlbumStore = create<AlbumState>((set) => ({
  albums: [],
  isLoading: false,
  error: null,

  loadAlbums: async () => {
    set({ isLoading: true, error: null })
    try {
      const albums = await getAlbums()
      set({ albums, isLoading: false })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to load albums', isLoading: false })
    }
  },

  addAlbum: async (name, isPrivate) => {
    const id = await createAlbum(name, isPrivate)
    const albums = await getAlbums()
    set({ albums })
    return id
  },

  removeAlbum: async (id) => {
    await deleteAlbum(id)
    const albums = await getAlbums()
    set({ albums })
  },

  addAssetsToAlbum: async (albumId, assetIds) => {
    await dbAddAssets(albumId, assetIds)
  },

  removeAssetsFromAlbum: async (albumId, assetIds) => {
    await dbRemoveAssets(albumId, assetIds)
  },
}))
