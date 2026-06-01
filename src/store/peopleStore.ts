import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import { type Asset } from '@/lib/mediaLibrary'
import {
  saveFaceEmbedding,
  getAllClusters,
  getScannedAssetIds,
  renameCluster,
  getAssetIdsForCluster,
  type FaceClusterRow,
} from '@/lib/db'
import { detectFacesInAsset } from '@/lib/faceDetector'
import { runClustering } from '@/lib/faceClusterer'

const LAST_SCANNED_KEY = 'gathr.people.lastScanned'
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const BATCH_SIZE = 10
// Only show clusters with at least 3 photos
const MIN_CLUSTER_SIZE = 3

export interface PersonCluster {
  id: string
  name: string | null
  coverAssetId: string
  photoCount: number
}

type PeopleState = {
  clusters: PersonCluster[]
  isScanning: boolean
  scanProgress: number      // 0–100
  lastScannedAt: number | null
}

type PeopleActions = {
  loadClusters: () => Promise<void>
  startScan: (assets: Asset[]) => Promise<void>
  renamePerson: (clusterId: string, name: string) => Promise<void>
  getPhotosForPerson: (clusterId: string) => Promise<string[]>
}

function rawToClusters(raw: FaceClusterRow[]): PersonCluster[] {
  return raw
    .filter((c): c is FaceClusterRow & { cover_asset_id: string } =>
      c.photo_count >= MIN_CLUSTER_SIZE && c.cover_asset_id !== null,
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      coverAssetId: c.cover_asset_id,
      photoCount: c.photo_count,
    }))
}

export const usePeopleStore = create<PeopleState & PeopleActions>((set) => ({
  clusters: [],
  isScanning: false,
  scanProgress: 0,
  lastScannedAt: null,

  loadClusters: async () => {
    const raw = await getAllClusters()
    const clusters = rawToClusters(raw)
    const lastRaw = await SecureStore.getItemAsync(LAST_SCANNED_KEY)
    const lastScannedAt = lastRaw !== null ? parseInt(lastRaw, 10) : null
    set({ clusters, lastScannedAt })
  },

  startScan: async (assets) => {
    set({ isScanning: true, scanProgress: 0 })
    try {
      const total = assets.length
      let processed = 0

      // Load all already-scanned asset IDs in one query instead of N per-asset round-trips
      const scannedIds = new Set(await getScannedAssetIds())

      for (let i = 0; i < assets.length; i += BATCH_SIZE) {
        const batch = assets.slice(i, i + BATCH_SIZE)

        for (const asset of batch) {
          try {
            if (scannedIds.has(asset.id)) {
              processed++
              continue
            }

            const uri = await asset.getUri()
            if (!uri) {
              processed++
              continue
            }

            const faces = await detectFacesInAsset(uri)
            for (const face of faces) {
              await saveFaceEmbedding({
                id: Crypto.randomUUID(),
                asset_id: asset.id,
                cluster_id: null,
                embedding: JSON.stringify(face.embedding),
                bbox_x: face.bbox.x,
                bbox_y: face.bbox.y,
                bbox_w: face.bbox.w,
                bbox_h: face.bbox.h,
                created_at: Date.now(),
              })
            }
          } catch {
            // Never throw — skip assets that fail
          }
          processed++
        }

        set({ scanProgress: Math.round((processed / total) * 90) })
        // Yield between batches so the UI stays responsive
        await new Promise<void>((r) => { setTimeout(r, 0) })
      }

      set({ scanProgress: 92 })
      await runClustering()
      set({ scanProgress: 98 })

      const now = Date.now()
      await SecureStore.setItemAsync(LAST_SCANNED_KEY, String(now))

      const clusters = rawToClusters(await getAllClusters())
      set({ clusters, isScanning: false, scanProgress: 100, lastScannedAt: now })
    } catch {
      set({ isScanning: false })
    }
  },

  renamePerson: async (clusterId, name) => {
    await renameCluster(clusterId, name)
    set((s) => ({
      clusters: s.clusters.map((c) => c.id === clusterId ? { ...c, name } : c),
    }))
  },

  getPhotosForPerson: async (clusterId) => {
    return getAssetIdsForCluster(clusterId)
  },
}))

export function shouldRescan(lastScannedAt: number | null): boolean {
  if (lastScannedAt === null) return true
  return Date.now() - lastScannedAt > SEVEN_DAYS_MS
}
