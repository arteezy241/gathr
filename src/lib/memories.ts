import { type StoredTrip } from '@/lib/db'
import { getPhotosByDateRange } from '@/lib/mediaLibrary'

const YEARS_BACK = 5
const TRIP_WINDOW_DAYS = 3

export type Memory = {
  id: string
  type: 'onThisDay' | 'tripMemory'
  label: string
  subtitle: string
  coverAssetId: string
  yearsAgo: number
  /** Set for tripMemory — navigate to /trip/[tripId] */
  tripId?: string
  /** Set for onThisDay — cover asset to open in photo viewer */
  photoCount: number
}

function startOfDay(year: number, month: number, day: number): number {
  return new Date(year, month, day, 0, 0, 0, 0).getTime()
}

function endOfDay(year: number, month: number, day: number): number {
  return new Date(year, month, day, 23, 59, 59, 999).getTime()
}

function yearsAgoLabel(n: number): string {
  return n === 1 ? '1 year ago' : `${String(n)} years ago`
}

function formatDate(year: number, month: number, day: number): string {
  return new Date(year, month, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export async function buildMemories(trips: StoredTrip[]): Promise<Memory[]> {
  const now = new Date()
  const todayMonth = now.getMonth()
  const todayDay = now.getDate()
  const todayYear = now.getFullYear()

  const yearTargets = Array.from({ length: YEARS_BACK }, (_, i) => i + 1)

  // Fetch "on this day" photos for each past year in parallel
  const photoResults = await Promise.all(
    yearTargets.map(async (yearsAgo) => {
      const year = todayYear - yearsAgo
      const photos = await getPhotosByDateRange(
        startOfDay(year, todayMonth, todayDay),
        endOfDay(year, todayMonth, todayDay),
        30,
      )
      return { yearsAgo, year, photos }
    }),
  )

  const memories: Memory[] = []

  for (const { yearsAgo, year, photos } of photoResults) {
    if (photos.length === 0) continue
    const cover = photos[Math.floor(photos.length / 2)]
    if (cover === undefined) continue

    memories.push({
      id: `onthisday-${String(year)}`,
      type: 'onThisDay',
      label: `On this day · ${yearsAgoLabel(yearsAgo)}`,
      subtitle: `${String(photos.length)} ${photos.length === 1 ? 'photo' : 'photos'} · ${formatDate(year, todayMonth, todayDay)}`,
      coverAssetId: cover.id,
      yearsAgo,
      photoCount: photos.length,
    })
  }

  // Trip memories — trips that started within ±TRIP_WINDOW_DAYS of today's month/day in a past year
  const windowMs = TRIP_WINDOW_DAYS * 24 * 60 * 60 * 1000
  for (const trip of trips) {
    const tripStart = new Date(trip.startDate)
    const tripYear = tripStart.getFullYear()
    const yearsAgo = todayYear - tripYear
    if (yearsAgo < 1 || yearsAgo > YEARS_BACK) continue

    const targetMs = startOfDay(tripYear, todayMonth, todayDay)
    if (Math.abs(trip.startDate - targetMs) > windowMs) continue

    memories.push({
      id: `trip-${trip.id}`,
      type: 'tripMemory',
      label: `${trip.label} · ${yearsAgoLabel(yearsAgo)}`,
      subtitle: trip.subtitle,
      coverAssetId: trip.coverAssetId,
      yearsAgo,
      tripId: trip.id,
      photoCount: trip.photoCount,
    })
  }

  // Nearest year first
  return memories.sort((a, b) => a.yearsAgo - b.yearsAgo)
}
