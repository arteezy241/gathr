import { Alert } from 'react-native'
import * as Sharing from 'expo-sharing'
import { type MediaLibraryAsset, createAsset } from '@/lib/mediaLibrary'

export async function shareAsset(asset: MediaLibraryAsset): Promise<void> {
  const uri = await asset.getUri()
  const available = await Sharing.isAvailableAsync()
  if (available) {
    await Sharing.shareAsync(uri)
  } else {
    Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.')
  }
}

export async function shareMultipleAssets(assets: MediaLibraryAsset[]): Promise<void> {
  if (assets.length === 0) return
  if (assets.length === 1) {
    const single = assets[0]
    if (single !== undefined) {
      await shareAsset(single)
    }
    return
  }
  Alert.alert('Coming Soon', 'Sharing multiple photos is coming soon.')
}

export async function saveAssetToLibrary(uri: string): Promise<void> {
  await createAsset(uri)
}
