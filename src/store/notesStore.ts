import { create } from 'zustand'
import {
  getNote,
  saveNote as dbSaveNote,
  deleteNote as dbDeleteNote,
  getTagsForAsset,
  addTag as dbAddTag,
  removeTag as dbRemoveTag,
} from '@/lib/db'

interface NotesState {
  // note text keyed by assetId
  notes: Record<string, string>
  // active tags keyed by assetId
  tags: Record<string, string[]>
  loadNote: (assetId: string) => Promise<void>
  saveNote: (assetId: string, text: string) => Promise<void>
  deleteNote: (assetId: string) => Promise<void>
  loadTags: (assetId: string) => Promise<void>
  addTag: (assetId: string, tag: string) => Promise<void>
  removeTag: (assetId: string, tag: string) => Promise<void>
}

export const useNotesStore = create<NotesState>((set) => ({
  notes: {},
  tags: {},

  async loadNote(assetId) {
    const row = await getNote(assetId)
    set((s) => ({ notes: { ...s.notes, [assetId]: row?.noteText ?? '' } }))
  },

  async saveNote(assetId, text) {
    await dbSaveNote(assetId, text)
    set((s) => ({ notes: { ...s.notes, [assetId]: text } }))
  },

  async deleteNote(assetId) {
    await dbDeleteNote(assetId)
    set((s) => {
      const notes = { ...s.notes }
      delete notes[assetId]
      return { notes }
    })
  },

  async loadTags(assetId) {
    const tags = await getTagsForAsset(assetId)
    set((s) => ({ tags: { ...s.tags, [assetId]: tags } }))
  },

  async addTag(assetId, tag) {
    const normalized = tag.trim().toLowerCase()
    if (!normalized) return
    await dbAddTag(assetId, normalized)
    set((s) => {
      const current = s.tags[assetId] ?? []
      if (current.includes(normalized)) return s
      return { tags: { ...s.tags, [assetId]: [...current, normalized] } }
    })
  },

  async removeTag(assetId, tag) {
    await dbRemoveTag(assetId, tag)
    set((s) => ({
      tags: {
        ...s.tags,
        [assetId]: (s.tags[assetId] ?? []).filter((t) => t !== tag),
      },
    }))
  },
}))
