# Gathr — Build Progress

## Stack
- **Runtime:** Expo SDK 56, React Native 0.85, React 19
- **Routing:** Expo Router (file-based)
- **DB:** expo-sqlite (WAL mode, foreign keys)
- **State:** Zustand
- **Media:** expo-media-library/next (Asset class, async API)
- **UI:** @shopify/flash-list, expo-image, expo-haptics
- **Auth:** expo-local-authentication
- **Sharing:** expo-sharing
- **Language:** TypeScript (strict), ESLint, Prettier

---

## Phases Completed

### Phase 0 — Project Scaffold
- Strict `tsconfig.json`, ESLint + Prettier config, path aliases (`@/`)
- Directory structure: `src/features/`, `src/lib/`, `src/store/`, `app/`
- `src/lib/mediaLibrary.ts` — single gateway for all `expo-media-library/next` access; ESLint `no-restricted-imports` blocks direct imports everywhere else
- CI script stubs

### Phase 1 — Gallery Grid
**Branch:** merged to `main`

- `src/lib/mediaLibrary.ts` — `getPhotosByDate`, `getRecentPhotos`, paginated cursor support
- `src/store/galleryStore.ts` — assets, isLoading, pagination state
- `src/features/gallery/hooks/useGallery.ts` — loads photos, handles pagination
- `src/features/gallery/components/PhotoGrid.tsx` — `FlashList` with date section headers, 3-column thumbnail rows, infinite scroll
- `src/features/gallery/components/PhotoThumb.tsx` — pressable thumbnail with selection circle overlay
- `src/features/gallery/components/DateSectionHeader.tsx` — date label with select-all toggle
- `app/(tabs)/index.tsx` — permissions gate, gallery screen
- `src/hooks/usePermissions.ts` — wraps `requestPermissions` / `getPermissions` from mediaLibrary

### Phase 2 — Bulk Selection
**Branch:** merged to `main`

- `src/store/selectionStore.ts` — `selectedIds` Set, `isSelecting`, `toggleSelect`, `selectRange`, `selectAll`, `clearSelection`
- Range selection: tap in selection mode extends selection from `lastSelectedId` to tapped item
- `src/features/gallery/components/SelectionBar.tsx` — animated slide-up bar, Select All, count label, Share / Add to Album / Delete action buttons
- Header updates to show selected count + Cancel button while selecting

### Phase 3 — Private Albums
**Branch:** merged to `main`

- `src/lib/db.ts` — SQLite init, `albums` + `album_assets` tables, CRUD: `createAlbum`, `getAlbums`, `getAlbum`, `deleteAlbum`, `addAssetsToAlbum`, `removeAssetsFromAlbum`, `getAlbumAssetIds`, `updateAlbumCover`
- `src/store/albumStore.ts` — Zustand store wrapping db functions
- `src/features/private-albums/hooks/useBiometricAuth.ts` — `expo-local-authentication` + `expo-secure-store` key; authenticate, isAuthenticated, isAuthenticating
- `app/album/[id].tsx` — album detail screen, biometric lock gate for private albums, 3-column photo grid, Add Photos stub
- Albums tab with album list, create/delete, private badge

### Phase 4 — Trip & Event Grouping
**Branch:** `feat/trip-grouping` → merged to `main`

- `src/lib/tripGrouper.ts` — time-gap algorithm: fetches async creation times, sorts assets, splits on 6-hour gaps, filters groups with < 4 photos, labels as "Saturday Adventure" (same-day) or "Trip · Dec 12–15" (multi-day), cover = middle asset
- `src/lib/db.ts` — extended with `trips` table, `saveTrips`, `getTrips`, `getTrip`, `clearTrips`, `StoredTrip` type
- `src/store/tripStore.ts` — `loadTrips`, `detectAndSaveTrips`, `clearAllTrips`
- `src/features/gallery/components/TripCard.tsx` — full-width card (screen width − 32), cover photo background via `expo-image`, semi-transparent overlay, 📍 label + subtitle
- `src/features/gallery/components/TripsSection.tsx` — horizontal scroll of TripCards, loading placeholders, "See All" → `/trips`
- `app/(tabs)/index.tsx` — auto-detects trips on first load (`lastGroupedAt === null`), injects `TripsSection` as `ListHeaderComponent` above the photo grid
- `app/trip/[id].tsx` — trip detail: hero image, meta row, async date-range asset filter, 3-column `FlashList`
- `app/trips.tsx` — all trips screen, "Regroup" button with `ActivityIndicator`, empty state

### Phase 5 — Photo Detail Viewer
**Branch:** `feat/photo-detail` → merged to `main`

- `app/photo/[id].tsx` — full-screen black viewer
  - `expo-image` with `contentFit="contain"`
  - Per-page `ScrollView` with `maximumZoomScale={5}` for pinch-to-zoom
  - Horizontal `FlatList` with `pagingEnabled` for swipe-between-photos
  - Context-aware asset list: `gallery` (all), `album` (by id), `trip` (date-range filter), or single-photo fallback
  - `initialScrollIndex` + `getItemLayout` to start at the tapped photo
  - `onViewableItemsChanged` updates the date label as user swipes
  - Header + footer overlays: animated fade in/out, auto-hide after 3 s, tap to toggle
  - Footer: formatted date ("Saturday, December 14, 2024 · 3:42 PM"), Share / Album / Favorite / Delete
  - Favorite toggles local state; Delete shows confirmation alert
- `PhotoGrid`, `album/[id]`, `trip/[id]` updated to pass `context` + `contextId` params on navigate

### Phase 6 — Sharing
**Branch:** `feat/sharing`

- `src/lib/mediaLibrary.ts` — added `createAsset(uri)` (wraps `Asset.create`) and re-exported `Asset` as a value for static method access
- `src/lib/sharing.ts`
  - `shareAsset(asset)` — calls `asset.getUri()`, checks `Sharing.isAvailableAsync()`, calls `Sharing.shareAsync` or alerts unavailable
  - `shareMultipleAssets(assets)` — delegates to `shareAsset` for one; shows "coming soon" alert for multiple
  - `saveAssetToLibrary(uri)` — calls `createAsset(uri)`
- `app/photo/[id].tsx` — Share button wired: `ActivityIndicator` while sharing, error alert on failure, disabled when no current asset
- `src/features/gallery/components/SelectionBar.tsx`
  - Share: filters selected assets, calls `shareMultipleAssets`, spinner on button, error alert
  - Add to Album: loads albums, presents `Alert.alert` action-sheet listing public albums, calls `addAssetsToAlbum` on selection, success haptic + alert, clears selection

---

## Key Architecture Decisions

| Decision | Reason |
|---|---|
| All `expo-media-library` access through `src/lib/mediaLibrary.ts` | ESLint `no-restricted-imports` enforces single gateway; prevents scattered direct imports |
| `expo-media-library/next` Asset class (async `getCreationTime()`) | SDK 56 `/next` API — no sync properties, all metadata is async |
| `ListHeaderComponent` on `FlashList` for TripsSection | Avoids nested `ScrollView`/`VirtualizedList` warning; single scroll container |
| `onViewableItemsChanged` via `useRef` | FlatList warns if this prop changes after mount; state setters are stable so closure is safe |
| `Alert.alert` for album action sheet | No native action-sheet dependency needed; works cross-platform |
| `StyleSheet.absoluteFill` not `absoluteFillObject` | `absoluteFillObject` doesn't exist in RN 0.85 |
| `expo-linear-gradient` not used | Not installed; gradient replaced with `rgba` overlay + `textShadow` |

---

## Files Created / Modified (cumulative)

```
app/
  (tabs)/index.tsx          — gallery screen, trips auto-detect
  album/[id].tsx            — album detail + biometric gate
  trip/[id].tsx             — trip detail + date-range photo filter
  trips.tsx                 — all trips + regroup
  photo/[id].tsx            — full-screen viewer + swipe + share

src/
  lib/
    mediaLibrary.ts         — expo-media-library gateway
    db.ts                   — SQLite: albums, album_assets, trips
    tripGrouper.ts          — time-gap grouping algorithm
    sharing.ts              — shareAsset, shareMultipleAssets, saveAssetToLibrary
    haptics.ts              — impactLight, impactMedium
    dateUtils.ts            — groupAssetsByDate
  store/
    galleryStore.ts
    selectionStore.ts
    albumStore.ts
    tripStore.ts
  features/
    gallery/components/
      PhotoGrid.tsx
      PhotoThumb.tsx
      DateSectionHeader.tsx
      SelectionBar.tsx
      TripCard.tsx
      TripsSection.tsx
    private-albums/hooks/
      useBiometricAuth.ts
  hooks/
    usePermissions.ts
```
