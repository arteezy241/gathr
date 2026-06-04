import { create } from 'zustand'
import { Platform, NativeModules } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import * as Notifications from 'expo-notifications'
import { getRecentPhotos } from '@/lib/mediaLibrary'
import {
  saveFaceEmbedding,
  getAllClusters,
  getScannedAssetIds,
  renameCluster,
  getAssetIdsForCluster,
  getFirstEmbeddingLength,
  clearAllFaceData,
  resetClustering,
  writeScanProgress,
  type FaceClusterRow,
} from '@/lib/db'
import { detectFacesInAsset, EMBEDDING_LENGTH } from '@/lib/faceDetector'
import { runClustering } from '@/lib/faceClusterer'

const FgNative: {
  startService: (config: object) => Promise<void>
  updateNotification: (config: object) => Promise<void>
  stopService: () => Promise<void>
} | null = Platform.OS === 'android' ? NativeModules.ForegroundService as typeof FgNative : null

const FG_NOTIF_ID = 9901

async function fgStart(message: string) {
  if (!FgNative) return
  try {
    await FgNative.startService({
      id: FG_NOTIF_ID,
      title: 'Gathr — Scanning Faces',
      message,
      ServiceType: 'specialUse',
      icon: 'ic_launcher',
      importance: 'high',
      ongoing: true,
      number: '1',
    })
    console.log('[FgService] startService OK')
  } catch (e) {
    console.warn('[FgService] startService failed:', e)
  }
}

async function fgUpdate(message: string) {
  try {
    await FgNative?.updateNotification({
      id: FG_NOTIF_ID,
      title: 'Gathr — Scanning Faces',
      message,
      ServiceType: 'specialUse',
      icon: 'ic_launcher',
      importance: 'high',
      ongoing: true,
    })
  } catch { /* non-critical */ }
}

async function fgStop() {
  try { await FgNative?.stopService() } catch { /* non-critical */ }
}

const LAST_SCANNED_KEY = 'gathr.people.lastScanned'
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const BATCH_SIZE = 10
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
  scanProgress: number
  scanScanned: number
  scanTotal: number
  lastScannedAt: number | null
  scanError: string | null
}

type PeopleActions = {
  loadClusters: () => Promise<void>
  startScan: () => Promise<void>
  recluster: () => Promise<void>
  wipeAndRescan: () => Promise<void>
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
  scanScanned: 0,
  scanTotal: 0,
  lastScannedAt: null,
  scanError: null,

  loadClusters: async () => {
    const raw = await getAllClusters()
    const clusters = rawToClusters(raw)
    const lastRaw = await SecureStore.getItemAsync(LAST_SCANNED_KEY)
    const lastScannedAt = lastRaw !== null ? parseInt(lastRaw, 10) : null
    set({ clusters, lastScannedAt })
  },

  startScan: async () => {
    set({ isScanning: true, scanProgress: 0, scanError: null })

    const finish = async () => {
      await fgStop()
      const now = Date.now()
      await SecureStore.setItemAsync(LAST_SCANNED_KEY, String(now))
      const clusters = rawToClusters(await getAllClusters())
      set({ clusters, isScanning: false, scanProgress: 100, lastScannedAt: now })
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'People scan complete',
            body: clusters.length > 0
              ? `Found ${String(clusters.length)} ${clusters.length === 1 ? 'person' : 'people'} in your library.`
              : 'No recognizable faces found.',
          },
          trigger: null,
        })
      } catch { /* non-critical */ }
    }

    try {
      await Notifications.requestPermissionsAsync()
      await fgStart('Running in the background…')
      await writeScanProgress(0, 0, 'scanning')

      const existingLen = await getFirstEmbeddingLength()
      if (existingLen !== null && existingLen !== EMBEDDING_LENGTH) {
        await clearAllFaceData()
        await SecureStore.deleteItemAsync(LAST_SCANNED_KEY)
      }

      const allAssets = await getRecentPhotos(2000)
      const assets = allAssets.filter((a) => !a.id.includes('/video/'))
      const total = assets.length
      const scannedIds = new Set(await getScannedAssetIds())
      let processed = 0

      set({ scanTotal: total, scanScanned: 0 })

      for (let i = 0; i < assets.length; i += BATCH_SIZE) {
        const batch = assets.slice(i, i + BATCH_SIZE)
        await Promise.allSettled(batch.map(async (asset) => {
          if (scannedIds.has(asset.id)) return
          const uri = await asset.getUri()
          if (!uri) return
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
        }))
        processed += batch.length
        const pct = Math.round((processed / total) * 90)
        set({ scanProgress: pct, scanScanned: processed })
        await fgUpdate(`Scanning photo ${String(processed)} of ${String(total)} (${String(pct)}%)`)
        await new Promise<void>((r) => { setTimeout(r, 0) })
      }

      set({ scanProgress: 95 })
      await runClustering()
      await finish()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await fgStop()
      set({ isScanning: false, scanError: msg })
    }
  },

  wipeAndRescan: async () => {
    await clearAllFaceData()
    await SecureStore.deleteItemAsync(LAST_SCANNED_KEY)
    set({ clusters: [], lastScannedAt: null })
    await usePeopleStore.getState().startScan()
  },

  recluster: async () => {
    set({ isScanning: true, scanProgress: 0, scanError: null })
    try {
      await resetClustering()
      await runClustering()
      const clusters = rawToClusters(await getAllClusters())
      set({ clusters, isScanning: false, scanProgress: 100 })
    } catch (e) {
      set({ isScanning: false, scanError: e instanceof Error ? e.message : String(e) })
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
