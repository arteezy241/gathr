import { cacheDirectory, readAsStringAsync, writeAsStringAsync, deleteAsync, EncodingType } from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { zipSync, type Zippable } from 'fflate'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'

export type ExportProgress = {
  current: number
  total: number
  phase: 'reading' | 'zipping' | 'sharing'
}

function uint8ToBase64(arr: Uint8Array): string {
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < arr.length; i += chunk) {
    binary += String.fromCharCode(...arr.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i)
  }
  return arr
}

export async function exportAssetsAsZip(
  assets: MediaLibraryAsset[],
  onProgress?: (p: ExportProgress) => void,
): Promise<void> {
  const total = assets.length
  const files: Zippable = {}

  // Phase 1: read each asset as base64 then convert to bytes
  for (let i = 0; i < assets.length; i++) {
    onProgress?.({ current: i + 1, total, phase: 'reading' })
    const uri = await assets[i]!.getUri()
    const b64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 })
    const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
    const filename = `photo_${String(i + 1).padStart(3, '0')}.${ext}`
    // level:0 = store (photos are already compressed — no point re-compressing)
    files[filename] = [base64ToUint8(b64), { level: 0 }]
  }

  // Phase 2: zip in memory
  onProgress?.({ current: total, total, phase: 'zipping' })
  const zipped = zipSync(files)

  // Phase 3: write to cache dir and open share sheet
  onProgress?.({ current: total, total, phase: 'sharing' })
  const zipPath = `${cacheDirectory ?? ''}gathr_export.zip`
  await writeAsStringAsync(zipPath, uint8ToBase64(zipped), { encoding: EncodingType.Base64 })

  const available = await Sharing.isAvailableAsync()
  if (!available) throw new Error('Sharing is not available on this device.')

  await Sharing.shareAsync(zipPath, {
    mimeType: 'application/zip',
    UTI: 'public.zip-archive',
    dialogTitle: `${String(total)} photo${total === 1 ? '' : 's'} from Gathr`,
  })

  // Clean up after share sheet closes
  await deleteAsync(zipPath, { idempotent: true })
}
