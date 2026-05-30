import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite'
import { type TripGroup } from '@/lib/tripGrouper'

export type Album = {
  id: string
  name: string
  isPrivate: boolean
  coverAssetId: string | null
  createdAt: number
  updatedAt: number
}

interface AlbumRow {
  id: string
  name: string
  is_private: number
  cover_asset_id: string | null
  created_at: number
  updated_at: number
}

interface AssetIdRow {
  asset_id: string
}

export type StoredTrip = {
  id: string
  label: string
  subtitle: string
  startDate: number
  endDate: number
  coverAssetId: string
  photoCount: number
  durationDays: number
  createdAt: number
}

interface TripRow {
  id: string
  label: string
  subtitle: string
  start_date: number
  end_date: number
  cover_asset_id: string
  photo_count: number
  duration_days: number
  created_at: number
}

let _db: SQLiteDatabase | null = null

async function getDb(): Promise<SQLiteDatabase> {
  if (_db === null) {
    _db = await openDatabaseAsync('gathr.db')
  }
  return _db
}

function rowToAlbum(row: AlbumRow): Album {
  return {
    id: row.id,
    name: row.name,
    isPrivate: row.is_private === 1,
    coverAssetId: row.cover_asset_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function initDb(): Promise<void> {
  const db = await getDb()
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS albums (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_private INTEGER NOT NULL DEFAULT 0,
      cover_asset_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      start_date INTEGER NOT NULL,
      end_date INTEGER NOT NULL,
      cover_asset_id TEXT NOT NULL,
      photo_count INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS album_assets (
      album_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (album_id, asset_id),
      FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
    );
  `)
}

export async function createAlbum(name: string, isPrivate: boolean): Promise<string> {
  const db = await getDb()
  const id = crypto.randomUUID()
  const now = Date.now()
  await db.runAsync(
    'INSERT INTO albums (id, name, is_private, cover_asset_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
    [id, name, isPrivate ? 1 : 0, now, now],
  )
  return id
}

export async function getAlbums(): Promise<Album[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<AlbumRow>('SELECT * FROM albums ORDER BY created_at DESC', [])
  return rows.map(rowToAlbum)
}

export async function getPrivateAlbums(): Promise<Album[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<AlbumRow>(
    'SELECT * FROM albums WHERE is_private = 1 ORDER BY created_at DESC',
    [],
  )
  return rows.map(rowToAlbum)
}

export async function getAlbum(id: string): Promise<Album | null> {
  const db = await getDb()
  const row = await db.getFirstAsync<AlbumRow>('SELECT * FROM albums WHERE id = ?', [id])
  return row !== null ? rowToAlbum(row) : null
}

export async function deleteAlbum(id: string): Promise<void> {
  const db = await getDb()
  await db.runAsync('DELETE FROM albums WHERE id = ?', [id])
}

export async function addAssetsToAlbum(albumId: string, assetIds: string[]): Promise<void> {
  if (assetIds.length === 0) return
  const db = await getDb()
  const now = Date.now()
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const assetId of assetIds) {
      await txn.runAsync(
        'INSERT OR IGNORE INTO album_assets (album_id, asset_id, added_at) VALUES (?, ?, ?)',
        [albumId, assetId, now],
      )
    }
  })
}

export async function removeAssetsFromAlbum(albumId: string, assetIds: string[]): Promise<void> {
  if (assetIds.length === 0) return
  const db = await getDb()
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const assetId of assetIds) {
      await txn.runAsync(
        'DELETE FROM album_assets WHERE album_id = ? AND asset_id = ?',
        [albumId, assetId],
      )
    }
  })
}

export async function getAlbumAssetIds(albumId: string): Promise<string[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<AssetIdRow>(
    'SELECT asset_id FROM album_assets WHERE album_id = ? ORDER BY added_at DESC',
    [albumId],
  )
  return rows.map((r) => r.asset_id)
}

export async function updateAlbumCover(albumId: string, assetId: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    'UPDATE albums SET cover_asset_id = ?, updated_at = ? WHERE id = ?',
    [assetId, Date.now(), albumId],
  )
}

function rowToStoredTrip(row: TripRow): StoredTrip {
  return {
    id: row.id,
    label: row.label,
    subtitle: row.subtitle,
    startDate: row.start_date,
    endDate: row.end_date,
    coverAssetId: row.cover_asset_id,
    photoCount: row.photo_count,
    durationDays: row.duration_days,
    createdAt: row.created_at,
  }
}

export async function saveTrips(trips: TripGroup[]): Promise<void> {
  if (trips.length === 0) return
  const db = await getDb()
  const now = Date.now()
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const trip of trips) {
      await txn.runAsync(
        `INSERT OR REPLACE INTO trips
          (id, label, subtitle, start_date, end_date, cover_asset_id, photo_count, duration_days, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          trip.id,
          trip.label,
          trip.subtitle,
          trip.startDate.getTime(),
          trip.endDate.getTime(),
          trip.coverAsset.id,
          trip.photoCount,
          trip.durationDays,
          now,
        ],
      )
    }
  })
}

export async function getTrips(): Promise<StoredTrip[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<TripRow>('SELECT * FROM trips ORDER BY start_date DESC', [])
  return rows.map(rowToStoredTrip)
}

export async function getTrip(id: string): Promise<StoredTrip | null> {
  const db = await getDb()
  const row = await db.getFirstAsync<TripRow>('SELECT * FROM trips WHERE id = ?', [id])
  return row !== null ? rowToStoredTrip(row) : null
}

export async function clearTrips(): Promise<void> {
  const db = await getDb()
  await db.runAsync('DELETE FROM trips', [])
}
