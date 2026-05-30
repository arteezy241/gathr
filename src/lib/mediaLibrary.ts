/**
 * ALL expo-media-library/next access goes through this module only.
 * Features must never import expo-media-library directly.
 */
import {
  type Asset,
  type PermissionResponse,
  Query,
  AssetField,
  MediaType,
  requestPermissionsAsync,
  getPermissionsAsync,
} from 'expo-media-library/next'

export type { Asset, PermissionResponse }

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
  // afterCursor encodes the page offset as a stringified integer
  const offset = afterCursor !== undefined ? parseInt(afterCursor, 10) : 0
  return new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .offset(offset)
    .limit(limit)
    .exe()
}

export async function getRecentPhotos(limit: number): Promise<Asset[]> {
  return new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .limit(limit)
    .exe()
}
