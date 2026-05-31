import { getRecentPhotos, type MediaLibraryAsset as Asset } from '@/lib/mediaLibrary'

/** Max photos to scan in one pass — keeps it under ~3s on mid-range devices. */
const SCAN_LIMIT = 600
/** Photos taken within this window are considered a burst group. */
const BURST_WINDOW_MS = 3_000
/** Parallel batch size for resolving creation times. */
const TIME_BATCH = 50

export type DuplicateGroup = {
  id: string
  assets: Asset[]
  /** Index of the asset we suggest keeping (middle of burst = most considered shot). */
  suggestedKeepIndex: number
}

type TimedAsset = { asset: Asset; ms: number }

async function resolveCreationTimes(assets: Asset[]): Promise<TimedAsset[]> {
  const results: TimedAsset[] = []
  for (let i = 0; i < assets.length; i += TIME_BATCH) {
    const batch = assets.slice(i, i + TIME_BATCH)
    const times = await Promise.all(
      batch.map(async (asset) => {
        try {
          const ms = await asset.getCreationTime()
          return ms !== null ? { asset, ms } : null
        } catch {
          return null
        }
      }),
    )
    for (const t of times) {
      if (t !== null) results.push(t)
    }
  }
  return results
}

export async function scanForDuplicates(
  onProgress?: (pct: number) => void,
): Promise<DuplicateGroup[]> {
  onProgress?.(0)

  const assets = await getRecentPhotos(SCAN_LIMIT)
  onProgress?.(10)

  const timed = await resolveCreationTimes(assets)
  onProgress?.(70)

  // Sort oldest-first to make sliding-window clustering straightforward
  timed.sort((a, b) => a.ms - b.ms)

  const groups: DuplicateGroup[] = []
  let i = 0
  let groupSeq = 0

  while (i < timed.length) {
    const windowStart = timed[i]
    if (windowStart === undefined) break
    const cluster: TimedAsset[] = [windowStart]
    let j = i + 1

    while (j < timed.length) {
      const next = timed[j]
      if (next === undefined || next.ms - windowStart.ms > BURST_WINDOW_MS) break
      cluster.push(next)
      j++
    }

    if (cluster.length >= 2) {
      groupSeq += 1
      const midIndex = Math.floor(cluster.length / 2)
      groups.push({
        id: `dup-${String(groupSeq)}`,
        assets: cluster.map((t) => t.asset),
        suggestedKeepIndex: midIndex,
      })
    }

    i = j
  }

  onProgress?.(100)
  return groups
}
