# Gathr — Build Progress

> Working memory. Full phase-by-phase history lives in `PHASES.md` (read on request only).

## Stack
- **Runtime:** Expo SDK 56, React Native 0.85, React 19
- **Routing:** Expo Router (file-based)
- **DB:** expo-sqlite (WAL mode, foreign keys)
- **State:** Zustand
- **Media:** expo-media-library/next (Asset class, async API)
- **UI:** @shopify/flash-list, expo-image, expo-haptics
- **Gestures:** react-native-gesture-handler, react-native-reanimated, react-native-worklets
- **Auth:** expo-local-authentication
- **Sharing:** expo-sharing
- **File I/O:** expo-file-system (legacy API via `expo-file-system/legacy`)
- **Compression:** fflate (pure JS zip, no native code)
- **Camera:** expo-camera
- **Image editing:** expo-image-manipulator
- **Notifications:** expo-notifications
- **Location:** expo-location (reverse geocoding)
- **SVG:** react-native-svg (inline illustrations)
- **Language:** TypeScript (strict), ESLint, Prettier

## Conventions
- All `expo-media-library` access goes through `src/lib/mediaLibrary.ts` only (ESLint `no-restricted-imports` enforces this everywhere else)
- Feature-driven structure: `src/features/`, `src/lib/`, `src/store/`, `app/`
- Branching: GitHub Flow (`feat/`, `fix/`, `chore/`, `refactor/`); Conventional Commits
- TypeScript strict, no `any`

---

## Key Architecture Decisions

| Decision | Reason |
|---|---|
| All `expo-media-library` access through `src/lib/mediaLibrary.ts` | ESLint `no-restricted-imports` enforces single gateway |
| `expo-media-library/next` Asset class (async `getCreationTime()`) | SDK 56 `/next` API — all metadata is async |
| Creation time module-level cache (`Map<string, number>`) | Prevents repeated native bridge calls for the same asset |
| `ListHeaderComponent` on FlashList for GalleryHeader | Avoids nested ScrollView warning; single scroll container |
| `listHeaderHeightRef` via `onLayout` on header wrapper | Needed for drag-select `getAssetAt` Y hit-test |
| `saveTrips` does DELETE + re-INSERT atomically | Random IDs generated each grouping pass — INSERT OR REPLACE never matched |
| `new Asset(assetId)` in album detail | `galleryStore.allAssets` is paginated — filter misses photos not yet loaded |
| `Gesture.Simultaneous(pinch, tap)` when not zoomed | Excludes pan so single-finger swipe reaches FlatList paging |
| `isZoomedShared` worklet flag | Prevents `runOnJS` bridge call on every pinch frame |
| `InteractionManager.runAfterInteractions` in photo detail | DB reads deferred until screen transition finishes |
| `useSelectionActions` hook | Share/export/add/delete logic shared between FloatingTabBar (icons) and SelectionBar (Select All pill) |
| SelectionBar = "Select All" pill only | All action icons moved into FloatingTabBar pill; cleaner separation of concerns |
| `fflate` with `level:0` (store mode) for ZIP | Photos already JPEG/HEIC compressed — deflate adds CPU with negligible size saving |
| `expo-file-system/legacy` import path | SDK 56 moved classic API to `/legacy` |
| `ALTER TABLE trips ADD COLUMN place TEXT` with try/catch | SQLite has no `ADD COLUMN IF NOT EXISTS`; catch handles already-exists on existing installs |
| `context: 'memory'` in photo viewer | Prevents viewer from using full gallery (where old photos may be paginated out); re-fetches that day's photos fresh |
| `recordAsync` + 400ms settle delay for video | Native camera needs time to switch from picture to video mode before `recordAsync` is safe to call |
| Zoom values calibrated small (0.015 for 2×, 0.04 for 5×) | Flagship Android (Xiaomi 15) has ~200× digital max; `expo-camera zoom` is 0–1 of device max |
| `_dbPromise` memoizes `openAndInit()` in `db.ts` | Prevents concurrent `execAsync` rejections when `initDb()` is called from multiple entry points simultaneously |
| `memoriesGroupedAtRef` tracks last `lastGroupedAt` loaded | Fires memories load on mount (undefined ≠ null) and again after trip detection (null ≠ timestamp), without reloading on unrelated `trips` reference changes |
| "Save as Album" button embedded in TripCard | Removes redundant suggestion row; action lives where the trip is already displayed |
| `moveToTrash` does NOT call `deleteAssetsAsync` | Asset stays in device library; only Gathr hides it. Permanent deletion is deferred to explicit user action or 30-day auto-purge |
| Gallery filter reads `useTrashStore.getState()` (not subscribed) | Avoids re-rendering gallery on every trash operation; filter applies at fetch time, not on state change |
| `galleryStore.invalidate()` / `refreshKey` | Clean decoupled signal for useGallery to refetch without trashStore knowing about the gallery |
| `UndoToastProvider` inside `SafeAreaProvider` | Allows `useSafeAreaInsets()` inside the provider for correct bottom positioning above FloatingTabBar |
| Landmark-based embedding vs. true semantic embedding | ML Kit still-image API provides landmark {x,y} positions only (no 128-d embedding); we flatten+normalize to 0–1 relative to face bbox. Cheaper, fully on-device, no model download, but pose/lighting-sensitive. |
| `hasEmbeddingForAsset` check before detection | Skips re-running ML Kit on already-processed assets so re-scans are fast; clustering is always re-run on unclustered rows only |
| `persistClusteringResults` single transaction | Cluster upserts and embedding assignments committed atomically to prevent orphaned face_embeddings rows if the app crashes mid-clustering |
| `MIN_CLUSTER_SIZE = 3` | Hides noise clusters from single stray face detections; only people in ≥ 3 photos are shown |
| `FACE_CLUSTER_THRESHOLD` (0.6 landmark / 1.0 for L2-normalized 192-d) | Tighter values over-split the same person, looser values merge different people |
| `MODIFICATION_TIME` sort in `getPhotosByDate` + `getRecentPhotos` | `CREATION_TIME` (DATE_TAKEN) is null for Android camera photos without EXIF; `DATE_MODIFIED` is always set |
| `getModificationTime()` fallback in `groupAssetsByDate` | Prevents null-EXIF photos grouping under 1970 header |
| `_createAssetAsync` from `expo-media-library/legacy` in `createAsset()` | SDK 56 deprecated the /next class-based `createAssetAsync`; legacy path is stable, returns numeric ID usable with `new Asset()` |
| 2-second delayed `galleryStore.invalidate()` after camera capture | Android MediaStore indexes new photos asynchronously; immediate query returns stale results |
| Background People scan + compact banner | Avoids blocking UI during 5–10 min ML Kit inference on large libraries |
| `sub.remove()` only in `useGallery` cleanup (not `removeAllListeners()`) | `removeAllListeners()` is global — kills every registered media-library listener across the app |
| `AppRegistry.registerHeadlessTask` in `index.ts`, not `_layout.tsx` | In a HeadlessJS context Android spawns a bare JS runtime — React component files never execute |
| `scan_progress` SQLite table as headless↔UI IPC | HeadlessJS task runs in a separate JS context with no shared memory; SQLite is the only reliable cross-context channel |
| `NativeModules.ForegroundService` direct call instead of library wrapper | `@supersami/rn-foreground-service` `start()` internally calls `runTask`, which fails if the headless task isn't registered yet |
| `foregroundServiceType="specialUse"` on Android 15 | Android 15 removed `dataSync`; `specialUse` + `FOREGROUND_SERVICE_SPECIAL_USE` permission is the only valid type for general background work |

---

## File Map

```
app/
  _layout.tsx                   — root layout, GestureHandlerRootView, screen registrations
  camera.tsx                    — Google Camera-style: Photo/Video/Burst/Scan modes, pinch zoom, timer, grid
  duplicates.tsx                — duplicate/burst detector, review UI (legacy entry; still intact)
  cleanup.tsx                   — Clean-Up Dashboard: 5-state machine, swipe card-stack; dupes wired, near/blurry/videos stubbed
  memory/[id].tsx               — memory detail: fetches that day's photos, 3-column grid
  (tabs)/
    _layout.tsx                 — FloatingTabBar
    index.tsx                   — gallery screen, search bar, GalleryHeader wiring
    trips.tsx                   — all trips list
    albums.tsx                  — albums list, create, import, sort, duplicate entry point
  onboarding.tsx                — 4-slide first-launch flow: Welcome / Trips / Private / Permissions
  album/[id].tsx                — album detail, biometric gate, picker, ScrollIndicator
  trash.tsx                     — recently deleted: 3-col grid, countdown badges, peek modal, empty trash
  trip/[id].tsx                 — trip detail, hero image, photo grid
  photo/[id].tsx                — full-screen viewer, RNGH zoom, video player, image editing; contexts: gallery/album/trip/memory/person
  people/[id].tsx               — person detail: 3-col FlashList, editable name header, tap opens photo viewer

src/
  lib/
    mediaLibrary.ts             — expo-media-library gateway
    onboarding.ts               — hasCompletedOnboarding / markOnboardingComplete via expo-secure-store
    db.ts                       — SQLite: albums, album_assets, trips (+place), favorites, trip_album_dismissed, trash, face_embeddings, face_clusters, scan_progress, photo_notes, photo_tags
    tripGrouper.ts              — time-gap grouping + reverse geocoding
    geocoding.ts                — getPlaceName via expo-location.reverseGeocodeAsync
    nativeAlbumImport.ts        — device album importer
    sharing.ts                  — shareAsset, shareMultipleAssets
    exportZip.ts                — ZIP via fflate + expo-file-system/legacy
    memories.ts                 — buildMemories: on-this-day + trip memory cards
    notifications.ts            — daily 9 AM memory reminder
    duplicateDetector.ts        — burst detection via creation time clustering
    faceDetector.ts             — detectFacesInAsset; TFLite MobileFaceNet embedding + bbox
    faceClusterer.ts            — runClustering: greedy nearest-neighbor; euclideanDistance, updateCentroid
    faceScanHeadless.ts         — HeadlessJS task (GathrFaceScanTask); self-contained scan + clustering; writes to scan_progress
    haptics.ts                  — haptic wrappers
    dateUtils.ts                — groupAssetsByDate, creation time cache
    theme.ts                    — darkColors, lightColors, spacing, radius, typography
    themeContext.tsx            — ThemeProvider, useTheme()
  store/
    galleryStore.ts
    selectionStore.ts
    albumStore.ts
    tripStore.ts
    favoriteStore.ts
    memoriesStore.ts
    tripSuggestionStore.ts
    duplicateStore.ts           — scan, deleteFromGroup, dismissGroup
    trashStore.ts               — moveToTrash, restoreFromTrash, permanentlyDelete, emptyTrash, purgeExpired
    peopleStore.ts              — startScan (batch 10, skip already-scanned), loadClusters, renamePerson, getPhotosForPerson; scanScanned/scanTotal banner state
    notesStore.ts               — notes + tags keyed by assetId; loadNote/saveNote/deleteNote, loadTags/addTag/removeTag; optimistic writes
  components/
    ui/
      Skeleton.tsx
      GlassView.tsx
      FloatingTabBar.tsx        — pill nav + selection mode (count + icons + Cancel)
      ScrollIndicator.tsx
      UndoToast.tsx             — slide-up toast, 4s auto-dismiss; UndoToastProvider + useUndoToast()
      PermissionsEmptyState.tsx — SVG photo-frame+lock; "Open Settings" via Linking; used in all three tabs
  features/
    gallery/
      hooks/useGallery.ts
      components/
        PhotoGrid.tsx           — accepts optional emptyComponent prop (passed to FlashList ListEmptyComponent)
        PhotoThumb.tsx
        DateSectionHeader.tsx
        SelectionBar.tsx        — "Select All" pill only; action logic in useSelectionActions
        TripCard.tsx
        TripsSection.tsx        — location clustering via clusterByPlace()
        TripSuggestions.tsx
        MemoryCard.tsx
        MemoriesSection.tsx
        PhotoSearchResults.tsx  — date-parsing search, 350ms debounce
        GalleryEmptyState.tsx   — SVG camera; "Open Camera" button
        TripsEmptyState.tsx     — SVG mountain+sun; no button
        PhotoNotesSheet.tsx     — peek/expanded note+tags bottom sheet; opens from photo/[id].tsx footer
    albums/components/
      AlbumCard.tsx
      CreateAlbumSheet.tsx
      PhotoPickerModal.tsx
      AlbumsEmptyState.tsx      — SVG folder; "Create Album" button via onCreateAlbum prop
    private-albums/hooks/
      useBiometricAuth.ts
  hooks/
    usePermissions.ts
    useSelectionActions.ts      — share/export/add/delete logic shared across FloatingTabBar + SelectionBar
```

---

## Known Issues / Pending
- Clean-Up Dashboard (`cleanup.tsx`) not yet wired to any tab/button — navigate to `/cleanup` manually; `near`/`blurry`/`videos` categories are commented-out stubs with no backing detection logic
- `shareMultipleAssets` opens one share sheet per photo sequentially — ZIP export is the better bulk path
- `surfaceType="textureView"` in VideoView is Android-only; silently ignored on iOS
- Zoom tap buttons (2×/5×) are approximate — `expo-camera zoom` is 0–1 of device max, which varies by device; no API to query actual max zoom ratio from JS
- People scan time on large libraries: ~5–10 min for 1 000 photos (ML Kit inference + bridge overhead per asset)
- Face clustering accuracy degrades with large pose/lighting variation — landmark-based embedding has no semantic understanding of identity
- HeadlessJS scan (`GathrFaceScanTask`) awaiting confirmed end-to-end device test — task launches and `index.ts` registration in place; background progress past 0% not yet verified post-rebuild
- **[BUG — HIGH]** `createAsset()` in `mediaLibrary.ts` line 57: `new Asset(saved.id)` wraps bare numeric ID on Android; `/next` Query expects a `content://` URI — album covers saved via in-app camera show blank. Fix: `content://media/external/images/media/${saved.id}` on Android
- **[BUG — MEDIUM]** Face crop bounds not clamped after origin clamp in `faceDetector.ts` lines 98–101: `cropW/cropH` can exceed image dimensions → `ImageInvalidCropException` silently drops faces near edges. Fix: `Math.min(cropW, imageWidth - cropX)` / `Math.min(cropH, imageHeight - cropY)`
- **[BUG — MEDIUM]** `startScan` outer catch in `peopleStore.ts` swallows errors silently — user can't distinguish a crash from zero results. Fix: surface via `scanError` state or UndoToast
- **[LOW]** Gallery sorted by `MODIFICATION_TIME` but grouped by `getCreationTime()` — edited photos sort to top but appear under original year header
- **[LOW]** Dead-code `?? 0` fallback in `dateUtils.ts` line 90 — unreachable but silently returns 1970 on future cache miss; replace with `console.warn`
