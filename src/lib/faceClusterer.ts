import * as Crypto from 'expo-crypto'
import {
  getEmbeddingsWithoutCluster,
  getAllClusters,
  persistClusteringResults,
  type FaceClusterRow,
} from '@/lib/db'
import { EMBEDDING_LENGTH } from '@/lib/faceDetector'

// Two-pass clustering thresholds on L2-normalized 192-d MobileFaceNet embeddings.
//
// Pass 1 — tight seed formation (greedy NN):
//   impure seed (strangers in same cluster) → lower SEED_THRESHOLD
export const SEED_THRESHOLD = 0.7
//
// Pass 2 — centroid merge (pairwise on stable averages):
//   strangers merged into one person   → lower MERGE_THRESHOLD (not SEED)
//   same person split across clusters  → raise MERGE_THRESHOLD
export const MERGE_THRESHOLD = 0.72

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
  const corruptEmbeddingIds: string[] = []

  // 3. Pass 1 — tight greedy NN seed formation (SEED_THRESHOLD)
  //    Each seed cluster should be pure (confident same person).
  //    One person may produce several seeds if pose/lighting varies — pass 2 merges them.
  for (const emb of unclustered) {
    const vec = JSON.parse(emb.embedding) as number[]
    if (vec.length !== EMBEDDING_LENGTH) {
      // Corrupt or legacy row — delete so it stops polluting future clustering passes.
      corruptEmbeddingIds.push(emb.id)
      continue
    }

    let bestClusterId: string | null = null
    let bestDist = SEED_THRESHOLD

    for (const [cid, centroid] of clusterCentroids.entries()) {
      if (centroid.length !== EMBEDDING_LENGTH) continue
      const dist = euclideanDistance(centroid, vec)
      if (dist < bestDist) {
        bestDist = dist
        bestClusterId = cid
      }
    }

    const bboxArea = emb.bbox_w * emb.bbox_h

    if (bestClusterId === null) {
      // No nearby seed — start a new one
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
      // Assign to nearest seed, update centroid as running average
      const existing = clusterUpdates.get(bestClusterId)
      if (existing === undefined) continue
      const newCount = existing.photo_count + 1
      const oldCentroid = clusterCentroids.get(bestClusterId) ?? vec
      const newCentroid = updateCentroid(oldCentroid, vec, newCount)
      clusterCentroids.set(bestClusterId, newCentroid)

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

  // 4. Pass 2 — centroid merge (MERGE_THRESHOLD)
  //    Compare stable cluster centroids pairwise. Safer than comparing raw embeddings
  //    because centroids average out pose/lighting noise.
  //    Repeat until no pair merges (handles transitivity: A↔B, B↔C → A=B=C).
  //    Tuning: strangers merged → lower MERGE_THRESHOLD  |  same person split → raise MERGE_THRESHOLD
  let anyMerged = true
  while (anyMerged) {
    anyMerged = false
    const ids = Array.from(clusterUpdates.keys())
    outer: for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i] as string
        const idB = ids[j] as string
        const centA = clusterCentroids.get(idA)
        const centB = clusterCentroids.get(idB)
        if (!centA || !centB) continue
        if (euclideanDistance(centA, centB) >= MERGE_THRESHOLD) continue

        // Merge B into A — weighted centroid, sum counts, pick larger-bbox cover
        const clA = clusterUpdates.get(idA)
        const clB = clusterUpdates.get(idB)
        if (!clA || !clB) continue
        const newCount = clA.photo_count + clB.photo_count
        const newCentroid = centA.map((v, k) =>
          (v * clA.photo_count + (centB[k] ?? 0) * clB.photo_count) / newCount,
        )
        const areaA = clusterMaxBboxArea.get(idA) ?? 0
        const areaB = clusterMaxBboxArea.get(idB) ?? 0
        const newCover = areaB > areaA ? clB.cover_asset_id : clA.cover_asset_id

        clusterCentroids.set(idA, newCentroid)
        clusterMaxBboxArea.set(idA, Math.max(areaA, areaB))
        clusterUpdates.set(idA, {
          ...clA,
          cover_asset_id: newCover,
          centroid: JSON.stringify(newCentroid),
          photo_count: newCount,
          updated_at: Date.now(),
        })

        // Remap all of B's embedding assignments to A
        for (const assignment of embeddingAssignments) {
          if (assignment.clusterId === idB) assignment.clusterId = idA
        }

        clusterCentroids.delete(idB)
        clusterMaxBboxArea.delete(idB)
        clusterUpdates.delete(idB)

        anyMerged = true
        break outer  // ids array is stale after deletion — restart the sweep
      }
    }
  }

  // 5. Persist all updates in a single transaction
  await persistClusteringResults(Array.from(clusterUpdates.values()), embeddingAssignments, corruptEmbeddingIds)
}
