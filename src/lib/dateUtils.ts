import { type MediaLibraryAsset } from '@/lib/mediaLibrary'

export interface AssetDateGroup {
  date: string
  label: string
  assets: MediaLibraryAsset[]
}

export interface AssetMonthGroup {
  yearMonth: string
  label: string
  assets: MediaLibraryAsset[]
}

export function isToday(date: Date): boolean {
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

export function isYesterday(date: Date): boolean {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  )
}

export function isThisWeek(date: Date): boolean {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  return date >= startOfWeek && date <= now
}

export function formatDateLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  if (isThisWeek(date)) {
    return date.toLocaleDateString('en-US', { weekday: 'long' })
  }
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function toYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${String(y)}-${m}-${d}`
}

function toYearMonth(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${String(y)}-${m}`
}

interface Resolved {
  asset: MediaLibraryAsset
  ms: number
}

// Module-level cache — avoids re-fetching creation time for the same asset across re-renders
const creationTimeCache = new Map<string, number>()

async function resolveTimestamps(assets: MediaLibraryAsset[]): Promise<Resolved[]> {
  // Split into already-cached and uncached
  const uncached = assets.filter((a) => !creationTimeCache.has(a.id))

  // Fetch uncached in small batches to avoid flooding the native bridge
  const BATCH = 20
  for (let i = 0; i < uncached.length; i += BATCH) {
    const batch = uncached.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async (asset) => {
        const ms = await asset.getCreationTime()
        creationTimeCache.set(asset.id, ms ?? 0)
      }),
    )
  }

  return assets.map((asset) => ({ asset, ms: creationTimeCache.get(asset.id) ?? 0 }))
}

export async function groupAssetsByDate(assets: MediaLibraryAsset[]): Promise<AssetDateGroup[]> {
  const resolved = await resolveTimestamps(assets)

  const map = new Map<string, Resolved[]>()
  for (const entry of resolved) {
    const date = toYMD(new Date(entry.ms))
    const bucket = map.get(date)
    if (bucket !== undefined) {
      bucket.push(entry)
    } else {
      map.set(date, [entry])
    }
  }

  const groups: AssetDateGroup[] = []
  for (const [date, entries] of map) {
    entries.sort((a, b) => b.ms - a.ms)
    groups.push({
      date,
      label: formatDateLabel(new Date(date + 'T00:00:00')),
      assets: entries.map((e) => e.asset),
    })
  }

  groups.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return groups
}

export async function groupAssetsByMonth(
  assets: MediaLibraryAsset[],
): Promise<AssetMonthGroup[]> {
  const resolved = await resolveTimestamps(assets)

  const map = new Map<string, Resolved[]>()
  for (const entry of resolved) {
    const ym = toYearMonth(new Date(entry.ms))
    const bucket = map.get(ym)
    if (bucket !== undefined) {
      bucket.push(entry)
    } else {
      map.set(ym, [entry])
    }
  }

  const groups: AssetMonthGroup[] = []
  for (const [yearMonth, entries] of map) {
    entries.sort((a, b) => b.ms - a.ms)
    const [year, month] = yearMonth.split('-')
    const labelDate = new Date(Number(year), Number(month) - 1, 1)
    groups.push({
      yearMonth,
      label: labelDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      assets: entries.map((e) => e.asset),
    })
  }

  groups.sort((a, b) => (a.yearMonth < b.yearMonth ? 1 : a.yearMonth > b.yearMonth ? -1 : 0))
  return groups
}
