import { Album } from '@/lib/mediaLibrary'
import { initDb, createAlbum, addAssetsToAlbum, updateAlbumCover, getAlbums as getGathrAlbums } from '@/lib/db'

const SKIP_TITLES = new Set([
  'Recents', 'All Photos', 'Camera Roll', 'Recently Added',
  'Favorites', 'Recently Deleted', 'Hidden',
])

export interface ImportResult {
  imported: number
  skipped: number
  total: number
}

export async function importNativeAlbums(
  onProgress?: (current: number, total: number, albumName: string) => void,
): Promise<ImportResult> {
  await initDb()
  const nativeAlbums = await Album.getAll()

  const existing = await getGathrAlbums()
  const existingNames = new Set(existing.map((a) => a.name.toLowerCase()))

  let imported = 0
  let skipped = 0
  let processed = 0

  for (const nativeAlbum of nativeAlbums) {
    const title = await nativeAlbum.getTitle()
    processed++

    if (SKIP_TITLES.has(title)) {
      skipped++
      continue
    }

    onProgress?.(processed, nativeAlbums.length, title)

    if (existingNames.has(title.toLowerCase())) {
      skipped++
      continue
    }

    const assets = await nativeAlbum.getAssets()
    if (assets.length === 0) {
      skipped++
      continue
    }

    // Sort by creation time descending (newest first)
    const withTimes = await Promise.all(
      assets.map(async (a) => ({ a, t: (await a.getCreationTime()) ?? 0 }))
    )
    withTimes.sort((x, y) => y.t - x.t)
    const sorted = withTimes.map((w) => w.a)
    const albumId = await createAlbum(title, false)
    const assetIds = sorted.map((a) => a.id)

    const coverId = sorted[0]?.id
    if (coverId !== undefined) {
      await updateAlbumCover(albumId, coverId)
    }

    await addAssetsToAlbum(albumId, assetIds)
    existingNames.add(title.toLowerCase())
    imported++
  }

  return { imported, skipped, total: nativeAlbums.length }
}
