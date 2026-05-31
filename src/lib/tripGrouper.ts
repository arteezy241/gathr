import * as Crypto from 'expo-crypto'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'
import { getPlaceName } from '@/lib/geocoding'

function generateId(): string {
  return Crypto.randomUUID()
}

export const GAP_THRESHOLD_HOURS = 6
export const MIN_PHOTOS = 4

export type TripGroup = {
  id: string
  label: string
  subtitle: string
  assets: MediaLibraryAsset[]
  startDate: Date
  endDate: Date
  durationDays: number
  photoCount: number
  coverAsset: MediaLibraryAsset
  place: string | null
}

const MS_PER_HOUR = 1000 * 60 * 60
const MS_PER_DAY = MS_PER_HOUR * 24

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatDateRange(start: Date, end: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const sm = months[start.getMonth()]
  const em = months[end.getMonth()]
  const sd = start.getDate()
  const ed = end.getDate()
  if (sm === em) {
    return `${sm ?? ''} ${String(sd)}–${String(ed)}`
  }
  return `${sm ?? ''} ${String(sd)} – ${em ?? ''} ${String(ed)}`
}

function durationDays(start: Date, end: Date): number {
  const startDay = Math.floor(start.getTime() / MS_PER_DAY)
  const endDay = Math.floor(end.getTime() / MS_PER_DAY)
  return endDay - startDay
}

function buildLabel(start: Date, end: Date, days: number, place: string | null): string {
  if (days === 0) {
    const dayName = DAY_NAMES[start.getDay()] ?? 'Day'
    return place !== null ? `${place}` : `${dayName} Adventure`
  }
  return place !== null ? `${place} · ${formatDateRange(start, end)}` : `Trip · ${formatDateRange(start, end)}`
}

function buildSubtitle(days: number, photoCount: number): string {
  if (days === 0) {
    return `1 day · ${String(photoCount)} ${photoCount === 1 ? 'photo' : 'photos'}`
  }
  return `${String(days)} ${days === 1 ? 'day' : 'days'} · ${String(photoCount)} ${photoCount === 1 ? 'photo' : 'photos'}`
}

export async function groupAssetsIntoTrips(assets: MediaLibraryAsset[]): Promise<TripGroup[]> {
  if (assets.length === 0) return []

  const withTimes = await Promise.all(
    assets.map(async (asset) => {
      const ms = await asset.getCreationTime()
      return { asset, ms }
    }),
  )

  const sorted = withTimes
    .filter((e): e is { asset: MediaLibraryAsset; ms: number } => e.ms !== null)
    .sort((a, b) => a.ms - b.ms)

  if (sorted.length === 0) return []

  const firstEntry = sorted[0]
  if (firstEntry === undefined) return []

  const rawGroups: Array<typeof sorted> = []
  let current: typeof sorted = [firstEntry]

  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1]
    const curr = sorted[i]
    if (prev === undefined || curr === undefined) continue
    const gapHours = (curr.ms - prev.ms) / MS_PER_HOUR
    if (gapHours > GAP_THRESHOLD_HOURS) {
      rawGroups.push(current)
      current = [curr]
    } else {
      current.push(curr)
    }
  }
  rawGroups.push(current)

  const trips: TripGroup[] = []

  for (const group of rawGroups) {
    if (group.length < MIN_PHOTOS) continue

    const first = group[0]
    const last = group[group.length - 1]
    if (first === undefined || last === undefined) continue
    const startDate = new Date(first.ms)
    const endDate = new Date(last.ms)
    const days = durationDays(startDate, endDate)
    const photoCount = group.length
    const midIndex = Math.floor(group.length / 2)
    const midEntry = group[midIndex]
    if (midEntry === undefined) continue
    const coverAsset = midEntry.asset

    // Attempt reverse geocoding from EXIF coordinates — no GPS permission required
    let place: string | null = null
    try {
      const loc = await coverAsset.getLocation()
      if (loc !== null) {
        place = await getPlaceName(loc.latitude, loc.longitude)
      }
    } catch {
      // Location unavailable — continue without place name
    }

    trips.push({
      id: generateId(),
      label: buildLabel(startDate, endDate, days, place),
      subtitle: buildSubtitle(days, photoCount),
      assets: group.map((e) => e.asset),
      startDate,
      endDate,
      durationDays: days,
      photoCount,
      coverAsset,
      place,
    })
  }

  return trips.sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
}
