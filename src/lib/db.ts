import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite'
import * as Crypto from 'expo-crypto'
import { type TripGroup } from '@/lib/tripGrouper'

function generateId(): string {
  return Crypto.randomUUID()
}

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
  place: string | null
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
  place: string | null
}

let _dbPromise: Promise<SQLiteDatabase> | null = null

async function openAndInit(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync('gathr.db')
  // Run PRAGMAs individually — mixing them with DDL in one execAsync can fail
  await db.execAsync('PRAGMA journal_mode = WAL;')
  await db.execAsync('PRAGMA foreign_keys = ON;')
  await db.execAsync(`
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

    CREATE TABLE IF NOT EXISTS favorites (
      asset_id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trip_album_dismissed (
      trip_id TEXT PRIMARY KEY,
      dismissed_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trash (
      asset_id TEXT PRIMARY KEY,
      original_uri TEXT NOT NULL,
      deleted_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS face_embeddings (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      cluster_id TEXT,
      embedding TEXT NOT NULL,
      bbox_x REAL, bbox_y REAL, bbox_w REAL, bbox_h REAL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS face_clusters (
      id TEXT PRIMARY KEY,
      name TEXT,
      cover_asset_id TEXT,
      centroid TEXT NOT NULL,
      photo_count INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
  `)
  try {
    await db.execAsync('ALTER TABLE trips ADD COLUMN place TEXT;')
  } catch {
    // Column already exists — ignore
  }
  return db
}

function getDb(): Promise<SQLiteDatabase> {
  if (_dbPromise === null) {
    _dbPromise = openAndInit()
  }
  return _dbPromise
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

/** Call once at app startup to warm-up the DB. All queries already wait for init via getDb(). */
export async function initDb(): Promise<void> {
  await getDb()
}

export async function createAlbum(name: string, isPrivate: boolean): Promise<string> {
  const db = await getDb()
  const id = generateId()
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
    place: row.place ?? null,
  }
}

export async function saveTrips(trips: TripGroup[]): Promise<void> {
  const db = await getDb()
  const now = Date.now()
  await db.withExclusiveTransactionAsync(async (txn) => {
    // Full refresh — clear then re-insert so re-grouping never produces duplicates
    await txn.runAsync('DELETE FROM trips', [])
    for (const trip of trips) {
      await txn.runAsync(
        `INSERT INTO trips
          (id, label, subtitle, start_date, end_date, cover_asset_id, photo_count, duration_days, created_at, place)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          trip.place ?? null,
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

export async function getFavoriteIds(): Promise<string[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<{ asset_id: string }>(
    'SELECT asset_id FROM favorites ORDER BY created_at DESC',
    [],
  )
  return rows.map((r) => r.asset_id)
}

export async function addFavorite(assetId: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    'INSERT OR IGNORE INTO favorites (asset_id, created_at) VALUES (?, ?)',
    [assetId, Date.now()],
  )
}

export async function removeFavorite(assetId: string): Promise<void> {
  const db = await getDb()
  await db.runAsync('DELETE FROM favorites WHERE asset_id = ?', [assetId])
}

export async function getDismissedTripIds(): Promise<Set<string>> {
  const db = await getDb()
  const rows = await db.getAllAsync<{ trip_id: string }>('SELECT trip_id FROM trip_album_dismissed', [])
  return new Set(rows.map((r) => r.trip_id))
}

export async function dismissTripSuggestion(tripId: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    'INSERT OR IGNORE INTO trip_album_dismissed (trip_id, dismissed_at) VALUES (?, ?)',
    [tripId, Date.now()],
  )
}

// ── Trash ─────────────────────────────────────────────────────────────────────

export interface TrashRow {
  asset_id: string
  original_uri: string
  deleted_at: number
}

export async function addToTrash(assetId: string, uri: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    'INSERT OR REPLACE INTO trash (asset_id, original_uri, deleted_at) VALUES (?, ?, ?)',
    [assetId, uri, Date.now()],
  )
}

export async function removeFromTrash(assetId: string): Promise<void> {
  const db = await getDb()
  await db.runAsync('DELETE FROM trash WHERE asset_id = ?', [assetId])
}

export async function getAllTrash(): Promise<TrashRow[]> {
  const db = await getDb()
  return db.getAllAsync<TrashRow>(
    'SELECT asset_id, original_uri, deleted_at FROM trash ORDER BY deleted_at DESC',
    [],
  )
}

export async function purgeExpiredTrash(beforeMs: number): Promise<string[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<{ asset_id: string }>(
    'SELECT asset_id FROM trash WHERE deleted_at < ?',
    [beforeMs],
  )
  const ids = rows.map((r) => r.asset_id)
  if (ids.length > 0) {
    await db.runAsync('DELETE FROM trash WHERE deleted_at < ?', [beforeMs])
  }
  return ids
}

export async function clearTrash(): Promise<void> {
  const db = await getDb()
  await db.runAsync('DELETE FROM trash', [])
}

// ── Face Detection ────────────────────────────────────────────────────────────

export interface FaceEmbeddingRow {
  id: string
  asset_id: string
  cluster_id: string | null
  embedding: string       // JSON float array
  bbox_x: number
  bbox_y: number
  bbox_w: number
  bbox_h: number
  created_at: number
}

export interface FaceClusterRow {
  id: string
  name: string | null
  cover_asset_id: string | null
  centroid: string        // JSON float array (running average)
  photo_count: number
  updated_at: number
}

export async function saveFaceEmbedding(row: FaceEmbeddingRow): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT OR REPLACE INTO face_embeddings
      (id, asset_id, cluster_id, embedding, bbox_x, bbox_y, bbox_w, bbox_h, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.asset_id, row.cluster_id ?? null, row.embedding,
      row.bbox_x, row.bbox_y, row.bbox_w, row.bbox_h, row.created_at],
  )
}

export async function getEmbeddingsWithoutCluster(): Promise<FaceEmbeddingRow[]> {
  const db = await getDb()
  return db.getAllAsync<FaceEmbeddingRow>(
    'SELECT * FROM face_embeddings WHERE cluster_id IS NULL',
    [],
  )
}

export async function getAllClusters(): Promise<FaceClusterRow[]> {
  const db = await getDb()
  return db.getAllAsync<FaceClusterRow>(
    'SELECT * FROM face_clusters ORDER BY photo_count DESC',
    [],
  )
}

export async function updateEmbeddingCluster(id: string, clusterId: string): Promise<void> {
  const db = await getDb()
  await db.runAsync('UPDATE face_embeddings SET cluster_id = ? WHERE id = ?', [clusterId, id])
}

export async function upsertCluster(row: FaceClusterRow): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT OR REPLACE INTO face_clusters
      (id, name, cover_asset_id, centroid, photo_count, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    [row.id, row.name ?? null, row.cover_asset_id ?? null, row.centroid, row.photo_count, row.updated_at],
  )
}

export async function renameCluster(clusterId: string, name: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    'UPDATE face_clusters SET name = ?, updated_at = ? WHERE id = ?',
    [name, Date.now(), clusterId],
  )
}

export async function getAssetIdsForCluster(clusterId: string): Promise<string[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<{ asset_id: string }>(
    'SELECT DISTINCT asset_id FROM face_embeddings WHERE cluster_id = ?',
    [clusterId],
  )
  return rows.map((r) => r.asset_id
  )
}

export async function persistClusteringResults(
  clusterRows: FaceClusterRow[],
  embeddingAssignments: { id: string; clusterId: string }[],
  corruptEmbeddingIds: string[] = [],
): Promise<void> {
  const db = await getDb()
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const c of clusterRows) {
      await txn.runAsync(
        `INSERT OR REPLACE INTO face_clusters
          (id, name, cover_asset_id, centroid, photo_count, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
        [c.id, c.name ?? null, c.cover_asset_id ?? null, c.centroid, c.photo_count, c.updated_at],
      )
    }
    for (const { id, clusterId } of embeddingAssignments) {
      await txn.runAsync('UPDATE face_embeddings SET cluster_id = ? WHERE id = ?', [clusterId, id])
    }
    for (const id of corruptEmbeddingIds) {
      await txn.runAsync('DELETE FROM face_embeddings WHERE id = ?', [id])
    }
  })
}

export async function getScannedAssetIds(): Promise<string[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<{ asset_id: string }>(
    'SELECT DISTINCT asset_id FROM face_embeddings',
    [],
  )
  return rows.map((r) => r.asset_id)
}

export async function hasEmbeddingForAsset(assetId: string): Promise<boolean> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM face_embeddings WHERE asset_id = ? LIMIT 1',
    [assetId],
  )
  return row !== null
}
