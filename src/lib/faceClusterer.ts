import * as Crypto from 'expo-crypto'
import {
  getEmbeddingsWithoutCluster,
  getAllClusters,
  persistClusteringResults,
  type FaceClusterRow,
} from '@/lib/db'

export const FACE_CLUSTER_THRESHOLD = 0.6

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return Infinity
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

export function updateCentroid(centroid: number[], newVec: number[], count: number): number[] {
  if (centroid.length !== newVec.length) return centroid
  return centroid.map((v, i) => (v * (count - 1) + (newVec[i] ?? 0)) / count)
}

export async function runClustering(): Promise<void> {
  // 1. Load unclustered embeddings
  const unclustered = await getEmbeddingsWithoutCluster()
  if (unclustered.length === 0) return

  // 2. Load existing cluster centroids
  const existingClusters = await getAllClusters()

  const clusterCentroids = new Map<string, number[]>(
    existingClusters.map((c) => [c.id, JSON.parse(c.centroid) as number[]]),
  )
  const clusterUpdates = new Map<string, FaceClusterRow>(
    existingClusters.map((c) => [c.id, { ...c }]),
  )
  // Track max bbox area seen per cluster in this pass so cover stays the largest face
  const clusterMaxBboxArea = new Map<string, number>(
    existingClusters.map((c) => [c.id, 0]),
  )
  const embeddingAssignments: { id: string; clusterId: string }[] = []

  // 3. Greedy nearest-neighbor assignment
  for (const emb of unclustered) {
    const vec = JSON.parse(emb.embedding) as number[]
    if (vec.length === 0) continue

    let bestClusterId: string | null = null
    let bestDist = FACE_CLUSTER_THRESHOLD

    for (const [cid, centroid] of clusterCentroids.entries()) {
      if (centroid.length !== vec.length) continue
      const dist = euclideanDistance(centroid, vec)
      if (dist < bestDist) {
        bestDist = dist
        bestClusterId = cid
      }
    }

    const bboxArea = emb.bbox_w * emb.bbox_h

    if (bestClusterId === null) {
      // Create new cluster
      const newId = Crypto.randomUUID()
      clusterCentroids.set(newId, vec)
      clusterMaxBboxArea.set(newId, bboxArea)
      clusterUpdates.set(newId, {
        id: newId,
        name: null,
        cover_asset_id: emb.asset_id,
        centroid: JSON.stringify(vec),
        photo_count: 1,
        updated_at: Date.now(),
      })
      embeddingAssignments.push({ id: emb.id, clusterId: newId })
    } else {
      // Assign to existing cluster, update centroid as running average
      const existing = clusterUpdates.get(bestClusterId)
      if (existing === undefined) continue
      const newCount = existing.photo_count + 1
      const oldCentroid = clusterCentroids.get(bestClusterId) ?? vec
      const newCentroid = updateCentroid(oldCentroid, vec, newCount)
      clusterCentroids.set(bestClusterId, newCentroid)

      // Update cover to the face with the largest bbox area
      const prevMaxArea = clusterMaxBboxArea.get(bestClusterId) ?? 0
      const newCoverAssetId = bboxArea > prevMaxArea ? emb.asset_id : existing.cover_asset_id
      if (bboxArea > prevMaxArea) clusterMaxBboxArea.set(bestClusterId, bboxArea)

      clusterUpdates.set(bestClusterId, {
        ...existing,
        cover_asset_id: newCoverAssetId,
        centroid: JSON.stringify(newCentroid),
        photo_count: newCount,
        updated_at: Date.now(),
      })
      embeddingAssignments.push({ id: emb.id, clusterId: bestClusterId })
    }
  }

  // 4. Persist all updates in a single transaction
  await persistClusteringResults(Array.from(clusterUpdates.values()), embeddingAssignments)
}
