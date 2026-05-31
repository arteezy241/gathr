/**
 * ALL expo-media-library/next access goes through this module only.
 * Features must never import expo-media-library directly.
 */
import {
  Asset,
  Album,
  type PermissionResponse,
  Query,
  AssetField,
  MediaType,
  requestPermissionsAsync,
  getPermissionsAsync,
} from 'expo-media-library/next'
import {
  addListener as _addListener,
  removeAllListeners as _removeAllListeners,
  type MediaLibraryAssetsChangeEvent,
} from 'expo-media-library'

export type { PermissionResponse }
export { Asset, Album, MediaType }
export const addListener = _addListener
export const removeAllListeners = _removeAllListeners
export type { MediaLibraryAssetsChangeEvent }

/** Stable public alias for the expo-media-library Asset type. */
export type MediaLibraryAsset = Asset



export async function requestPermissions(): Promise<PermissionResponse> {
  return requestPermissionsAsync()
}

export async function getPermissions(): Promise<PermissionResponse> {
  return getPermissionsAsync()
}

export async function getPhotosByDate(
  limit = 100,
  afterCursor?: string,
): Promise<Asset[]> {
  const offset = afterCursor !== undefined ? parseInt(afterCursor, 10) : 0
  // Fetch both images and videos
  return new Query()
    .within(AssetField.MEDIA_TYPE, [MediaType.IMAGE, MediaType.VIDEO])
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .offset(offset)
    .limit(limit)
    .exe()
}

export async function createAsset(uri: string): Promise<Asset> {
  return Asset.create(uri)
}

export async function deleteAssets(assets: MediaLibraryAsset[]): Promise<void> {
  if (assets.length === 0) return
  await Asset.delete(assets)
}

export async function getRecentPhotos(limit: number): Promise<Asset[]> {
  return new Query()
    .within(AssetField.MEDIA_TYPE, [MediaType.IMAGE, MediaType.VIDEO])
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .limit(limit)
    .exe()
}

/** Fetch photos whose creation time falls within [startMs, endMs] (inclusive). */
export async function getPhotosByDateRange(
  startMs: number,
  endMs: number,
  limit = 30,
): Promise<Asset[]> {
  return new Query()
    .within(AssetField.MEDIA_TYPE, [MediaType.IMAGE, MediaType.VIDEO])
    .gte(AssetField.CREATION_TIME, startMs)
    .lte(AssetField.CREATION_TIME, endMs)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .limit(limit)
    .exe()
}
