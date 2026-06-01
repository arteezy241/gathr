import * as Sharing from 'expo-sharing'
import { type MediaLibraryAsset, createAsset } from '@/lib/mediaLibrary'

export async function shareAsset(asset: MediaLibraryAsset): Promise<void> {
  const uri = await asset.getUri()
  const available = await Sharing.isAvailableAsync()
  if (!available) throw new Error('Sharing is not available on this device.')
  await Sharing.shareAsync(uri)
}

export async function shareMultipleAssets(assets: MediaLibraryAsset[]): Promise<void> {
  if (assets.length === 0) return
  for (const asset of assets) {
    await shareAsset(asset)
  }
}

export async function saveAssetToLibrary(uri: string): Promise<void> {
  await createAsset(uri)
}
