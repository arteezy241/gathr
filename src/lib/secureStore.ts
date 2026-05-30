import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store'

function keyFor(albumId: string): string {
  return `gathr_album_key_${albumId}`
}

export async function saveEncryptionKey(albumId: string, key: string): Promise<void> {
  await setItemAsync(keyFor(albumId), key)
}

export async function getEncryptionKey(albumId: string): Promise<string | null> {
  return getItemAsync(keyFor(albumId))
}

export async function deleteEncryptionKey(albumId: string): Promise<void> {
  await deleteItemAsync(keyFor(albumId))
}

export function generateKey(): string {
  const bytes = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
