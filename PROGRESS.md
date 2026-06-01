# Gathr — Build Progress

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

---

## Phases Completed

### Phase 0 — Project Scaffold
- Strict `tsconfig.json`, ESLint + Prettier config, path aliases (`@/`)
- Directory structure: `src/features/`, `src/lib/`, `src/store/`, `app/`
- `src/lib/mediaLibrary.ts` — single gateway for all `expo-media-library/next` access; ESLint `no-restricted-imports` blocks direct imports everywhere else

### Phase 1 — Gallery Grid
- `getPhotosByDate` + `getRecentPhotos` + `getPhotosByDateRange` in `mediaLibrary.ts`
- `galleryStore` — assets, isLoading, pagination state
- `useGallery` hook — loads photos, infinite scroll, `addListener` for real-time refresh
- `PhotoGrid` — FlashList with date section headers, 3-column thumbnail rows, drag-to-select PanResponder
- `PhotoThumb` — pressable thumbnail, selection circle, press scale animation, long-press peek modal
- `DateSectionHeader` — date label with per-day select-all toggle

### Phase 2 — Bulk Selection
- `selectionStore` — `selectedIds` Set, `isSelecting`, `toggleSelect`, `rangeSelect`, `selectAll`, `clearSelection`, `selectByDate`, `selectByMonth`
- `SelectionBar` — small "Select All" pill above FloatingTabBar; `useSelectionActions` hook shared with FloatingTabBar
- `FloatingTabBar` selection mode — shows count + Share / Export ZIP / Add to Album / Delete icons + Cancel all in the main pill
- `useSelectionActions` hook — all action logic (share, export, add, delete) extracted for reuse
- Drag-to-select: PanResponder on PhotoGrid wrapper; `getAssetAt` hit-tests via cumulative Y offsets through listData (accounts for ListHeaderComponent height); only activates when `isSelecting`

### Phase 3 — Private Albums
- `db.ts` — SQLite init (WAL + FK), `albums`, `album_assets`, `trips`, `favorites`, `trip_album_dismissed` tables
- `albumStore` — wraps all album CRUD
- `useBiometricAuth` — `expo-local-authentication` + `expo-secure-store`
- `app/album/[id].tsx` — album detail, biometric lock gate, 3-column grid, Add Photos picker, ScrollIndicator
- Albums tab — list, create/delete, private badge, search, sort (name / newest / oldest / count), native album import

### Phase 4 — Trip & Event Grouping
- `tripGrouper.ts` — 6-hour gap algorithm, ≥4 photo minimum; reverse geocodes cover asset via `asset.getLocation()` + `expo-location.reverseGeocodeAsync`; labels as "Tagaytay · Jan 5–8" when place available, "Saturday Adventure" or "Trip · Dec 12–15" as fallbacks
- `geocoding.ts` — `getPlaceName(lat, lon)` wrapper; cascades city → district → region → country
- `db.ts` trips table — `place TEXT` column (added via `ALTER TABLE` with try/catch for existing installs); atomic DELETE + re-INSERT prevents duplicates
- `tripStore` — `loadTrips`, `detectAndSaveTrips`, `clearAllTrips`
- `TripCard` + `TripsSection` (location clustering) + `app/(tabs)/trips.tsx` + `app/trip/[id].tsx`
- **Location clustering** — `TripsSection` groups trips by place name into clusters; most-recent trip shown as card representative; accent badge shows "N trips" count when clustered

### Phase 5 — Photo Detail Viewer
- `app/photo/[id].tsx` — full-screen viewer, horizontal FlatList with pagingEnabled
- Context-aware asset list: `gallery`, `album`, `trip`, `memory`, or single-photo fallback
- `initialScrollIndex` + `getItemLayout` — starts at tapped photo with no layout measurement
- Header/footer overlays: 150ms fade-in, 220ms fade-out, auto-hide after 3s, tap to toggle
- Footer: formatted date, Share / Album / Favorite / Delete / Rotate / Flip actions (via `expo-image-manipulator`)

### Phase 6 — Sharing
- `sharing.ts` — `shareAsset`, `shareMultipleAssets`, `saveAssetToLibrary`
- Share wired in photo detail footer and SelectionBar

### Phase 7 — UI Polish
- **FloatingTabBar** — glassmorphic pill; Photos / Trips / Albums segment + Gathr title + camera icon + dark-mode toggle; selection mode shows count + action icons + Cancel
- **Theme system** — full dark/light token system, `ThemeProvider` + `useTheme()`; toggle persists via Zustand
- **GlassView** — `expo-blur` frosted glass wrapper used across tab bar, overlays, cards
- **Skeleton loaders** — pulsing animated placeholders (550ms cycle) for gallery, albums, trips
- **Image transitions** — `expo-image transition` prop on all images: 120ms thumbnails, 200ms cards, 250ms full-screen, 300ms hero
- **Press animations** — spring scale on PhotoThumb, AlbumCard, TripCard, MemoryCard (`onPressIn` → 0.96–0.97, `onPressOut` → 1 with bounce)
- **Stack header theming** — root Stack applies surface background + text tint; iOS gets `headerBlurEffect` glass
- **Safe area** — all screens apply `insets.top` padding

### Phase 8 — Native Album Import + Bug Fixes
- `nativeAlbumImport.ts` — imports device albums, skips system albums, deduplicates by name
- Album detail: `new Asset(assetId)` direct instantiation bypasses paginated store, works for any photo
- Album photo ordering: numeric media-store ID descending
- `ScrollIndicator` — expandable scroll pill, `transform: translateY` from `scrollY.interpolate`

### Phase 9 — Gestures + Video
- **Pinch-to-zoom** — RNGH `Gesture.Pinch()`, 1×–5×, spring snap-back; `Gesture.Pan()` while zoomed, clamped to image bounds
- **Double-tap to zoom** — 2.5× centered on tap; `Gesture.Exclusive(doubleTap, singleTap)`
- **Conditional pan** — pan excluded from gesture group when `isZoomed = false` so FlatList paging works; `isZoomedShared` worklet flag prevents `runOnJS` on every pinch frame
- **Photo peek modal** — long-press shows floating card (spring in `speed:32 bounciness:8`, 130ms exit); Open / Select / Close actions
- **Video support** — `expo-video`; `VideoPage` detects via `asset.getMediaType()`; custom glass controls (play/pause pill + scrubber pill); `surfaceType="textureView"` on Android; `setInterval` polls `currentTime` only while playing (250ms)
- **Drag-to-select restored** — PanResponder only attaches `panHandlers` when `isSelecting`; `getAssetAt` uses `listHeaderHeightRef` to subtract ListHeaderComponent height from Y offset

### Phase 10 — Performance
- **Creation time cache** — module-level `Map<string, number>` in `dateUtils.ts`; `getCreationTime()` called at most once per asset lifetime; batch size 20 to avoid bridge flooding
- **`memo` + `useCallback`** — `PhotoThumb` wrapped in `memo`; handlers stabilised with `useCallback` in PhotoGrid, photo detail FlatList, PhotoThumb
- **`InteractionManager`** deferred in `photo/[id].tsx` for `loadFavorites`/`loadAlbums` — DB reads wait until screen transition finishes
- **Gallery context init** — `contextAssets` initialised synchronously for `gallery` context so FlatList renders on first frame
- **Pinch runOnJS guard** — `isZoomedShared` shared value prevents bridge call on every pinch frame; only fires when zoomed state flips
- **Video interval** — scrubber `setInterval` only runs while `isPlaying`, pauses automatically when video is paused

### Phase 11 — Smart Memories
- `src/lib/memories.ts` — `buildMemories(trips)`: queries up to 5 past years in parallel via `getPhotosByDateRange`; cross-references trip store for "trip memory" cards within ±3 days of today's month/day
- `memoriesStore` — loads once per session; `loadedAt` gate prevents redundant runs; schedules daily 9 AM notification if memories exist
- `MemoryCard` — 220×150 card with image transition, press spring animation, GlassView overlay
- `MemoriesSection` — horizontal scroll above TripsSection; hidden when empty; skeleton while loading; routes to `/memory/[id]`
- `app/memory/[id].tsx` — detail screen; parses year from memory ID; re-fetches that day's photos via `getPhotosByDateRange`; 3-column grid; tapping opens photo viewer with `context: 'memory'` so viewer uses only that day's photos (not full gallery)
- Gallery header (`GalleryHeader`) — `MemoriesSection` → `TripSuggestions` → `TripsSection` stacked in FlashList `ListHeaderComponent`

### Phase 12 — Auto-Album Suggestions
- `trip_album_dismissed` table — persists dismissed trip IDs across sessions
- `tripSuggestionStore` — filters trips against dismissed set; `saveSuggestionAsAlbum` fetches photos, creates album, bulk-inserts, sets cover, refreshes `albumStore`
- `TripSuggestions` — dismissible horizontal cards between MemoriesSection and TripsSection

### Phase 13 — In-App Camera (Google Camera-style)
- `app/camera.tsx` — fullscreen modal, rebuilt from scratch with 4 shooting modes
- **Modes:** PHOTO · VIDEO · BURST · SCAN (carousel, tap to switch)
- **Zoom:** pinch-to-zoom via `Gesture.Simultaneous(Pinch, Tap)` + 0.5×/1×/2×/5× tap buttons; 0.5× uses `selectedLens: builtInUltraWideCamera` on iOS; values calibrated for high-zoom flagship Android (Xiaomi 15 / Pixel 9 Pro / Galaxy S25)
- **Tap to focus** — animated yellow focus ring, fades after 1s
- **Timer** — off/3s/10s; animated countdown number overlay
- **Grid** — rule of thirds overlay, toggleable
- **Flash** — 4 modes (off/on/auto/screen); becomes torch toggle in Video/Scan
- **Video** — `recordAsync` / `stopRecording`; mic permission via `useEffect` + 400ms settle delay; live `MM:SS` timer in top bar; red record shutter
- **Burst** — 5 shots at 250ms intervals; all saved; counter badge during capture
- **Scanner** — live QR/barcode/EAN/PDF417 decode; result banner with dismiss
- Camera icon in FloatingTabBar right cluster

### Phase 14 — Bulk Export as ZIP
- `src/lib/exportZip.ts` — reads each asset as base64; `fflate.zipSync` with `level:0`; shares via `expo-sharing`; deletes temp file after share sheet closes
- `ExportProgress` type — `{ current, total, phase: 'reading' | 'zipping' | 'sharing' }`
- Export button in FloatingTabBar selection mode with live progress

### Phase 15 — Photo Search
- `PhotoSearchResults.tsx` — date parsing: bare year (`2024`) or month+year (`March 2023`, `Jan 2024`); 350ms debounce; `getPhotosByDateRange` query; 3-column FlashList
- Search bar in gallery screen — animates in from height 0 (spring, no-bounce); search FAB (magnifying glass) above SelectionBar; Cancel collapses bar

### Phase 16 — Image Editing
- `manipulateAsync` wired into photo detail `···` options sheet
- Rotate 90°, Flip Horizontal, Flip Vertical — non-destructive (saves as new asset); gallery auto-refreshes

### Phase 17 — Notifications
- `src/lib/notifications.ts` — `setNotificationHandler` for foreground display; `scheduleDailyMemoryReminder` with `DAILY` trigger at 9 AM; idempotent (cancels previous before re-scheduling)
- Triggered automatically when memories are first built; only if memories exist (avoids empty-library permission prompt)

### Phase 18 — Location + Clustering
- `src/lib/geocoding.ts` — `getPlaceName(lat, lon)` via `expo-location.reverseGeocodeAsync`; no GPS permission needed (coordinates from photo EXIF)
- Trip labels enriched with place names during grouping
- `TripsSection` — `clusterByPlace()` groups trips by city; shows "N trips" accent badge on representative card

### Phase 19 — Duplicate Detector
- `src/lib/duplicateDetector.ts` — scans up to 600 recent photos; batch-resolves creation times (50 at a time); 3-second sliding window burst detection; `suggestedKeepIndex` points to middle shot
- `duplicateStore` — `scan()` with live 0–100% progress; `deleteFromGroup`; `dismissGroup`
- `app/duplicates.tsx` — three states: pre-scan, scanning (progress bar), results (group cards); thumbnails with green "Keep" badge + red trash overlay on tap; per-group Delete N / Dismiss actions
- Entry point: copy icon in Albums toolbar

### Phase 20 — Bug Fixes & UX Polish
- **DB init race fix** — `getDb()` now memoizes a single `openAndInit()` Promise; concurrent callers (layout + albums tab) all await the same Promise instead of firing duplicate `execAsync` calls; PRAGMAs run as separate `execAsync` calls before DDL to avoid rejection
- **Memories race fix** — gallery screen now calls `loadTrips()` on mount to pre-populate trips from DB; memories reload after each `detectAndSaveTrips` pass via `memoriesGroupedAtRef` (tracks last `lastGroupedAt` value loaded for), so trip memory cards appear correctly
- **Save as Album consolidated** — removed separate "Save as Album?" suggestion row above Trips & Events; "Save as Album" pill button now overlays each TripCard directly (top-right corner), visible only for unsaved trips; tapping saves + dismisses automatically
- **Album drag-to-select** — album detail (`album/[id].tsx`) now has full PanResponder drag-to-select matching the gallery grid: `getAssetAt` hit-tests via `THUMB_SIZE` row height (no date headers), `isSelectingRef`/`selectedIdsRef`/`rowsRef` kept current via effects, `panHandlers` applied only when `isSelecting`

### Phase 21 — Recycle Bin / Soft Delete
- **`trash` table** in SQLite — `asset_id`, `original_uri`, `deleted_at`; added to `openAndInit()` alongside other tables; `IF NOT EXISTS` handles existing installs with no migration
- **`trashStore`** — `moveToTrash` (adds to DB, does NOT delete from device), `restoreFromTrash` (removes from DB, calls `galleryStore.invalidate()`), `permanentlyDelete` (device delete via `permanentlyDeleteByIds` + DB removal), `emptyTrash` (bulk permanent delete + `clearTrash()`), `purgeExpired` (called on app start, permanently deletes anything older than 30 days)
- **Soft delete intercept** — `photo/[id].tsx` `handleDelete` and `useSelectionActions.handleDelete` both call `moveToTrash` instead of `deleteAssets`; both fire `hapticWarning()`; no Alert confirmation (action is reversible)
- **UndoToast** — `UndoToastProvider` wraps the app inside `SafeAreaProvider`; slides in from below FloatingTabBar (Animated.spring); auto-dismisses after 4s; `useUndoToast()` hook for any screen to trigger; new toast replaces any in-progress toast
- **Gallery filtering** — `useGallery.fetchPage` reads `useTrashStore.getState().items` after every page fetch and filters out trashed IDs client-side; cursor arithmetic uses raw `results.length` so pagination stays correct
- **Gallery refresh on restore** — `galleryStore.invalidate()` increments `refreshKey`; `useGallery` includes `refreshKey` in the `useEffect` deps for `fetchPage`, triggering a full refetch when an asset is restored from trash
- **Trash screen** (`app/trash.tsx`) — 3-column grid with countdown badge (`Xd`, red when ≤ 5 days); long-press or tap opens peek modal with Restore / Delete Forever / Close; "Empty" button in header with Alert confirmation; empty state with icon + explanation copy
- **Entry point** — trash icon in Albums tab toolbar alongside duplicate detector icon
- **Startup purge** — `_layout.tsx` calls `loadTrash()` then `purgeExpired()` on mount after `initDb()`

### Phase 22 — Onboarding Flow & Empty States
- **`src/lib/onboarding.ts`** — `hasCompletedOnboarding()` / `markOnboardingComplete()` backed by `expo-secure-store` key `gathr.onboarding.complete`
- **Onboarding gate** — `AppStack` in `_layout.tsx` checks SecureStore on mount; shows theme-colored blank while checking; redirects to `/onboarding` via `router.replace` if not done; gate runs once per install
- **`app/onboarding.tsx`** — 4-slide horizontal FlatList with `pagingEnabled`; tracks current index via `onViewableItemsChanged` (ref-stable callback, 50% viewability threshold); animated dot indicator (8px → 24px spring on active slide); "Skip" button top-right (hidden on slide 4); "Next →" ghost pill on slides 1–3; "Allow Access" / "Not Now" CTA stack on slide 4
  - Slide 1: animated 3×3 Skeleton mosaic + "Gathr" wordmark (48px bold)
  - Slide 2: SVG map pin + calendar, "Trips & Memories"
  - Slide 3: SVG padlock + keyhole, "Private Albums"
  - Slide 4: permission CTA — "Allow Access" calls `requestPermissions` then `markOnboardingComplete`; "Not Now" skips to tabs without requesting
- **`PermissionsEmptyState`** — reusable component (`src/components/ui/PermissionsEmptyState.tsx`); SVG photo frame with lock overlay; "Open Settings" button via `Linking.openSettings()`; shown in all three tabs when permission not granted
- **`GalleryEmptyState`** — SVG camera outline; "Open Camera" button; passed to `PhotoGrid` via new `emptyComponent` prop (avoids timing flash; PhotoGrid's `ListEmptyComponent` handles `isLoading` guard internally)
- **`TripsEmptyState`** — SVG mountain + sun; no button (trips appear automatically)
- **`AlbumsEmptyState`** — SVG folder outline; "Create Album" button calls parent's `setSheetVisible(true)` via `onCreateAlbum` prop
- **Tab wiring** — all three tabs show `PermissionsEmptyState` when `!requesting && !granted` (permission check takes priority); gallery passes `emptyComponent` to `PhotoGrid`; trips and albums replace their inline text empty states with the new components
- **`react-native-svg`** added to dependencies (was assumed transitive but not present)

### Phase 23 — People Tab (On-Device Face Clustering)
- **`src/lib/faceDetector.ts`** — `detectFacesInAsset(uri)`: calls ML Kit still-image API via `react-native-vision-camera-face-detector`; always emits exactly 20 floats (10 landmark keys × 2 coords) zero-padding missing landmarks so all vectors are the same length regardless of pose; returns `[]` on any error, never throws
- **`src/lib/faceClusterer.ts`** — `runClustering()`: loads unclustered embeddings, greedy nearest-neighbor assignment (`FACE_CLUSTER_THRESHOLD = 0.6` Euclidean), running-average centroid, largest-bbox cover; corrupt/legacy rows (wrong vector length) are deleted in the same transaction so they never re-enter future passes
- **`src/lib/db.ts`** additions — `face_embeddings` + `face_clusters` tables; `FaceEmbeddingRow`/`FaceClusterRow` interfaces; `saveFaceEmbedding`, `getEmbeddingsWithoutCluster`, `getAllClusters`, `updateEmbeddingCluster`, `upsertCluster`, `renameCluster`, `getAssetIdsForCluster`, `getScannedAssetIds`, `persistClusteringResults` (atomic transaction with corrupt-row delete), `hasEmbeddingForAsset`
- **`src/store/peopleStore.ts`** — `startScan`: loads all scanned asset IDs into a `Set` upfront (one query) instead of N per-asset round-trips; `rawToClusters()` type-predicate helper deduplicates the filter+map in `loadClusters` and `startScan`; `MIN_CLUSTER_SIZE = 3`; `lastScannedAt` persisted via `expo-secure-store`
- **`app/(tabs)/people.tsx`** — three states: never-scanned (SVG two-person silhouette + "Discover People" + "Scan Library" pill); scanning (progress bar reusing duplicates.tsx style); results (2-column FlashList of `PersonCard`); re-scan button top-right
- **`PersonCard`** — square card, expo-image cover, `expo-linear-gradient` overlay bottom half (transparent → rgba(0,0,0,0.6)), name bottom-left (unnamed → "Person N" 1-indexed), count badge bottom-right, long-press → inline TextInput rename
- **`app/people/[id].tsx`** — header with person name + pencil edit button; Alert.prompt on iOS, TextInput modal on Android; 3-column FlashList with memoised `renderItem`; tap photo → `/photo/[id]` with `context: 'person'` + `contextId: clusterId`
- **`app/photo/[id].tsx`** — added `'person'` to `PhotoContext` union; `getAssetIdsForCluster(contextId)` loads asset list same pattern as album/trip contexts
- **`FloatingTabBar`** — People added as fourth segment (icon: `people` / `people-outline`); per-segment `paddingHorizontal` reduced 14 → 10 to fit four tabs
- **`app.json`** — `react-native-vision-camera` plugin entry removed; package kept as peer dep only (expo-camera already covers permissions)

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
| Fixed-length 20-float landmark vectors (zero-pad missing landmarks) | Variable-length vectors cause Euclidean distance to return Infinity, fragmenting the same person across multiple sub-threshold clusters. Padding ensures all vectors are comparable regardless of pose/occlusion. |
| `getScannedAssetIds()` + Set upfront vs. per-asset `hasEmbeddingForAsset` | N sequential DB round-trips before any detection stall the progress bar; a single SELECT DISTINCT query + Set lookup converts the check to O(1) per asset |
| `persistClusteringResults` deletes corrupt rows | Zero-length or wrong-length embedding rows skipped by `continue` stay NULL and re-enter every clustering pass forever; delete them in the same transaction to prevent infinite re-fetch |
| `rawToClusters()` type-predicate filter | TypeScript doesn't narrow `cover_asset_id` from `string \| null` to `string` across `.filter().map()` chains; a type predicate filter avoids the `?? ''` fallback which would silently produce broken Image URIs if the filter guard were ever relaxed |
| `persistClusteringResults` single transaction | Cluster upserts, embedding assignments, and corrupt-row deletions are committed atomically to prevent orphaned rows if the app crashes mid-clustering |
| `MIN_CLUSTER_SIZE = 3` | Hides noise clusters from single stray face detections; only people who appear in ≥ 3 photos are shown |
| `FACE_CLUSTER_THRESHOLD = 0.6` (Euclidean) | Empirically chosen for landmark vectors; tighter values over-split the same person, looser values merge different people |
| `react-native-vision-camera` not registered as Expo plugin | The installed version has no `app.plugin.js`; loading its main entry in Node crashes the config evaluator. Permissions are already covered by expo-camera; the package is kept only as a peer dep for Nitro module types. |

---

## File Map

```
app/
  _layout.tsx                   — root layout, GestureHandlerRootView, screen registrations
  camera.tsx                    — Google Camera-style: Photo/Video/Burst/Scan modes, pinch zoom, timer, grid
  duplicates.tsx                — duplicate/burst detector, review UI
  memory/[id].tsx               — memory detail: fetches that day's photos, 3-column grid
  (tabs)/
    _layout.tsx                 — FloatingTabBar
    index.tsx                   — gallery screen, search bar, GalleryHeader wiring
    trips.tsx                   — all trips list
    albums.tsx                  — albums list, create, import, sort, duplicate entry point
    people.tsx                  — People tab: never-scanned / scanning / results states; PersonCard with long-press rename
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
    db.ts                       — SQLite: albums, album_assets, trips (+ place), favorites, trip_album_dismissed, face_embeddings, face_clusters
    tripGrouper.ts              — time-gap grouping + reverse geocoding
    geocoding.ts                — getPlaceName via expo-location.reverseGeocodeAsync
    nativeAlbumImport.ts        — device album importer
    sharing.ts                  — shareAsset, shareMultipleAssets
    exportZip.ts                — ZIP via fflate + expo-file-system/legacy
    memories.ts                 — buildMemories: on-this-day + trip memory cards
    notifications.ts            — daily 9 AM memory reminder
    duplicateDetector.ts        — burst detection via creation time clustering
    faceDetector.ts             — detectFacesInAsset via ML Kit; returns normalized landmark embedding + bbox
    faceClusterer.ts            — runClustering: greedy nearest-neighbor; euclideanDistance, updateCentroid
    haptics.ts                  — haptic wrappers
    dateUtils.ts                — groupAssetsByDate, creation time cache
    theme.ts                    — darkColors, lightColors, spacing, radius, typography
    themeContext.tsx             — ThemeProvider, useTheme()
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
    peopleStore.ts              — startScan (batch 10, skip already-scanned), loadClusters, renamePerson, getPhotosForPerson
  components/
    ui/
      Skeleton.tsx
      GlassView.tsx
      FloatingTabBar.tsx        — pill nav + selection mode (count + icons + Cancel)
      ScrollIndicator.tsx
      UndoToast.tsx             — slide-up toast with 4s auto-dismiss; UndoToastProvider + useUndoToast()
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
- `shareMultipleAssets` opens one share sheet per photo sequentially — ZIP export is the better bulk path
- `surfaceType="textureView"` in VideoView is Android-only; silently ignored on iOS
- Zoom tap buttons (2×/5×) are approximate — `expo-camera zoom` is 0–1 of device max zoom, which varies by device; no API to query actual max zoom ratio from JS
- People scan time on large libraries: ~5–10 min for 1 000 photos (ML Kit inference + bridge overhead per asset)
- Face clustering accuracy degrades with large pose/lighting variation — landmark-based embedding has no semantic understanding of identity
