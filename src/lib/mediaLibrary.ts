/**
 * ALL expo-media-library/next access goes through this module only.
 * Features must never import expo-media-library directly.
 */
import { type Asset, Query, AssetField, MediaType } from 'expo-media-library/next'

export type { Asset }

export async function getRecentPhotos(limit: number): Promise<Asset[]> {
  return new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .limit(limit)
    .exe()
}
