import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type FlashMode,
  type CameraMode,
  type CameraView as CameraViewType,
} from 'expo-camera'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAlbumStore } from '@/store/albumStore'
import { useSheet } from '@/components/ui/SheetProvider'
import { createAsset } from '@/lib/mediaLibrary'
import { addAssetsToAlbum, updateAlbumCover } from '@/lib/db'
import { hapticTap, hapticSuccess, hapticAction } from '@/lib/haptics'

// ─── Types ───────────────────────────────────────────────────────────────────

type ShootingMode = 'photo' | 'video' | 'burst' | 'scan'
type TimerSetting = 0 | 3 | 10
type ZoomLevel = 0.5 | 1 | 2 | 5

const MODES: { key: ShootingMode; label: string }[] = [
  { key: 'scan', label: 'SCAN' },
  { key: 'burst', label: 'BURST' },
  { key: 'photo', label: 'PHOTO' },
  { key: 'video', label: 'VIDEO' },
]

const ZOOM_LEVELS: ZoomLevel[] = [0.5, 1, 2, 5]

// Map logical zoom multiplier → expo-camera 0–1 range for DIGITAL zoom (Android + iOS fallback).
// expo-camera zoom is 0 (device min, ~1x) to 1 (device max). Values chosen to produce
// clearly visible zoom on mid-range phones (10–30x max); may over-zoom on ultra-flagships.
// iOS uses optical lens switching for 2x/5x via selectZoomLevel — these values are fallbacks.
function zoomLevelToValue(level: ZoomLevel): number {
  switch (level) {
    case 0.5: return 0    // ultrawide — handled via lens switching on iOS
    case 1:   return 0
    case 2:   return 0.15
    case 5:   return 0.4
  }
}

const BURST_COUNT = 5
const BURST_DELAY_MS = 250

const { width: SCREEN_W } = Dimensions.get('window')

// ─── Grid overlay ─────────────────────────────────────────────────────────────

function GridOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Vertical thirds */}
      <View style={[grid.line, grid.v1]} />
      <View style={[grid.line, grid.v2]} />
      {/* Horizontal thirds */}
      <View style={[grid.line, grid.h1]} />
      <View style={[grid.line, grid.h2]} />
    </View>
  )
}

const grid = StyleSheet.create({
  line: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.25)' },
  v1: { left: '33.33%', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  v2: { left: '66.66%', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  h1: { top: '33.33%', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  h2: { top: '66.66%', left: 0, right: 0, height: StyleSheet.hairlineWidth },
})

// ─── Focus ring ───────────────────────────────────────────────────────────────

function FocusRing({ x, y, opacity }: { x: number; y: number; opacity: Animated.Value }) {
  const scale = useRef(new Animated.Value(1.4)).current
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 0 }),
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start()
  }, [x, y])
  return (
    <Animated.View
      style={[
        focusStyles.ring,
        { left: x - 32, top: y - 32, opacity, transform: [{ scale }] },
      ]}
    />
  )
}

const focusStyles = StyleSheet.create({
  ring: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: '#FFD60A',
  },
})

// ─── Timer countdown overlay ──────────────────────────────────────────────────

function TimerOverlay({ count }: { count: number }) {
  const scale = useRef(new Animated.Value(0.5)).current
  const opacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    scale.setValue(0.5)
    opacity.setValue(1)
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 4 }),
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
    ]).start()
  }, [count])
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={timerStyles.center}>
        <Animated.Text style={[timerStyles.number, { opacity, transform: [{ scale }] }]}>
          {String(count)}
        </Animated.Text>
      </View>
    </View>
  )
}

const timerStyles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  number: {
    fontSize: 120,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
})

// ─── QR Result banner ────────────────────────────────────────────────────────

function ScanBanner({ result, onDismiss }: { result: string; onDismiss: () => void }) {
  return (
    <View style={bannerStyles.container} pointerEvents="box-none">
      <View style={bannerStyles.card}>
        <Text style={bannerStyles.label}>Scanned</Text>
        <Text style={bannerStyles.value} numberOfLines={3} selectable>{result}</Text>
        <Pressable onPress={onDismiss} style={bannerStyles.btn}>
          <Text style={bannerStyles.btnText}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  )
}

const bannerStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 160,
  },
  card: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 24,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    width: SCREEN_W - 48,
  },
  label: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600', letterSpacing: 0.5 },
  value: { fontSize: 15, color: '#FFFFFF', lineHeight: 20 },
  btn: { marginTop: 4, alignSelf: 'flex-end' },
  btnText: { color: '#0A84FF', fontSize: 14, fontWeight: '600' },
})

// ─── Elapsed timer hook ───────────────────────────────────────────────────────

function useElapsedTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (running) {
      setElapsed(0)
      intervalRef.current = setInterval(() => { setElapsed((e) => e + 1) }, 1000)
    } else {
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current !== null) clearInterval(intervalRef.current) }
  }, [running])
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CameraScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const [audioPermission, requestAudioPermission] = useMicrophonePermissions()
  const { albums } = useAlbumStore()
  const publicAlbums = albums.filter((a) => !a.isPrivate)
  const { showInfo, showSheet } = useSheet()

  // ── Core state ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<ShootingMode>('photo')
  const [facing, setFacing] = useState<'front' | 'back'>('back')
  const [flash, setFlash] = useState<FlashMode>('off')
  const [enableTorch, setEnableTorch] = useState(false)
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(1)
  const [zoomValue, setZoomValue] = useState(0)
  const [showGrid, setShowGrid] = useState(false)
  const [timer, setTimer] = useState<TimerSetting>(0)
  const [timerActive, setTimerActive] = useState(false)
  const [timerCount, setTimerCount] = useState(0)
  const [capturing, setCapturing] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [burstCount, setBurstCount] = useState(0)
  const [lastUri, setLastUri] = useState<string | null>(null)
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [videoModeReady, setVideoModeReady] = useState(false)
  const [availableLenses, setAvailableLenses] = useState<string[]>([])
  const [isPinching, setIsPinching] = useState(false)
  const pinchHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus ring
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null)
  const focusOpacity = useRef(new Animated.Value(0)).current

  const cameraRef = useRef<CameraViewType>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const videoSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recordingTimer = useElapsedTimer(isRecording)

  // Request mic permission when user switches to video mode — not during render
  useEffect(() => {
    if (mode === 'video') {
      setVideoModeReady(false)
      if (audioPermission !== null && !audioPermission.granted) {
        void requestAudioPermission()
      }
      // Give the native camera ~400ms to switch to video mode before allowing record
      videoSettleRef.current = setTimeout(() => { setVideoModeReady(true) }, 400)
    } else {
      setVideoModeReady(false)
      if (videoSettleRef.current !== null) clearTimeout(videoSettleRef.current)
    }
    return () => { if (videoSettleRef.current !== null) clearTimeout(videoSettleRef.current) }
  }, [mode])

  // ── Pinch-to-zoom ────────────────────────────────────────────────────────────
  const baseZoom = useSharedValue(0)
  const currentZoom = useSharedValue(0)

  function applyZoom(value: number) {
    const clamped = Math.max(0, Math.min(1, value))
    setZoomValue(clamped)
    // Snap displayed level to closest
    const snaps: ZoomLevel[] = [1, 2, 5]
    const mapped = snaps.reduce((prev, cur) =>
      Math.abs(zoomLevelToValue(cur) - clamped) < Math.abs(zoomLevelToValue(prev) - clamped) ? cur : prev,
    )
    setZoomLevel(mapped)
    // Show pinch indicator and auto-hide after 1.5s of no pinch
    setIsPinching(true)
    if (pinchHideTimer.current !== null) clearTimeout(pinchHideTimer.current)
    pinchHideTimer.current = setTimeout(() => { setIsPinching(false) }, 1500)
  }

  // Interpolate zoom 0–1 value to an approx ×N label using calibrated anchors
  function zoomValueToLabel(v: number): string {
    if (v <= 0) return '1×'
    if (v <= zoomLevelToValue(2)) {
      const ratio = 1 + (v / zoomLevelToValue(2))
      return `~${ratio.toFixed(1)}×`
    }
    if (v <= zoomLevelToValue(5)) {
      const t = (v - zoomLevelToValue(2)) / (zoomLevelToValue(5) - zoomLevelToValue(2))
      const ratio = 2 + t * 3
      return `~${ratio.toFixed(1)}×`
    }
    const t = (v - zoomLevelToValue(5)) / (1 - zoomLevelToValue(5))
    const ratio = 5 + t * 10
    return `~${ratio.toFixed(0)}×`
  }

  const pinchGesture = Gesture.Pinch()
    .onStart(() => { baseZoom.value = currentZoom.value })
    .onUpdate((e) => {
      // 0.08 multiplier keeps pinch proportional — pinching 2x doesn't blast to max zoom
      const delta = (e.scale - 1) * 0.08
      const next = Math.max(0, Math.min(1, baseZoom.value + delta))
      currentZoom.value = next
      scheduleOnRN(applyZoom, next)
    })

  // ── Tap to focus ─────────────────────────────────────────────────────────────
  const tapGesture = Gesture.Tap().onEnd((e) => {
    scheduleOnRN(handleTapFocus, e.x, e.y)
  })

  function handleTapFocus(x: number, y: number) {
    setFocusPoint({ x, y })
    focusOpacity.setValue(1)
  }

  const composed = Gesture.Simultaneous(pinchGesture, tapGesture)

  // ── Lens availability ────────────────────────────────────────────────────────
  const handleLensesChanged = useCallback((event: { lenses: string[] }) => {
    setAvailableLenses(event.lenses)
  }, [])

  const hasUltrawide = availableLenses.includes('builtInUltraWideCamera')

  // iOS telephoto lens names that give true optical zoom at their named multiplier
  const iosLensFor: Partial<Record<ZoomLevel, string[]>> = {
    0.5: ['builtInUltraWideCamera'],
    2:   ['builtIn2xTelephotoCamera', 'builtInTelephotoCamera'],
    5:   ['builtIn5xTelephotoCamera'],
  }

  function getIosLens(level: ZoomLevel): string | undefined {
    if (Platform.OS !== 'ios') return undefined
    const candidates = iosLensFor[level] ?? []
    return candidates.find((l) => availableLenses.includes(l))
  }

  function selectZoomLevel(level: ZoomLevel) {
    if (level === 0.5 && !hasUltrawide && Platform.OS === 'ios') return
    setZoomLevel(level)
    const usingLens = getIosLens(level) !== undefined
    // When switching to an optical lens, reset digital zoom to 0 so the
    // lens itself provides the multiplier rather than stacking digital on top.
    const value = usingLens ? 0 : zoomLevelToValue(level)
    setZoomValue(value)
    currentZoom.value = value
  }

  // ── Timer capture ─────────────────────────────────────────────────────────────
  function startTimerCapture() {
    if (timer === 0) {
      void doCapture()
      return
    }
    setTimerActive(true)
    setTimerCount(timer)
    let remaining = timer
    timerRef.current = setInterval(() => {
      remaining -= 1
      setTimerCount(remaining)
      if (remaining <= 0) {
        if (timerRef.current !== null) clearInterval(timerRef.current)
        setTimerActive(false)
        void doCapture()
      }
    }, 1000)
  }

  function cancelTimer() {
    if (timerRef.current !== null) clearInterval(timerRef.current)
    setTimerActive(false)
    setTimerCount(0)
  }

  // ── Capture ───────────────────────────────────────────────────────────────────
  async function doCapture(): Promise<void> {
    if (cameraRef.current === null || !cameraReady) return
    hapticTap()
    setCapturing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92, skipProcessing: false })
      setLastUri(photo.uri)
      const asset = await createAsset(photo.uri)
      if (selectedAlbumId !== null) {
        await addAssetsToAlbum(selectedAlbumId, [asset.id])
        await updateAlbumCover(selectedAlbumId, asset.id)
      }
      hapticSuccess()
    } catch (e) {
      showInfo('Capture failed', e instanceof Error ? e.message : 'Could not take photo.')
    } finally {
      setCapturing(false)
    }
  }

  // ── Burst mode ────────────────────────────────────────────────────────────────
  async function doBurst(): Promise<void> {
    if (cameraRef.current === null || !cameraReady) return
    hapticAction()
    setBurstCount(0)
    const uris: string[] = []
    for (let i = 0; i < BURST_COUNT; i++) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.88, skipProcessing: true })
        uris.push(photo.uri)
        setBurstCount(i + 1)
        if (i < BURST_COUNT - 1) await new Promise<void>((r) => setTimeout(r, BURST_DELAY_MS))
      } catch {
        break
      }
    }
    const assetIds: string[] = []
    for (const uri of uris) {
      try {
        const asset = await createAsset(uri)
        assetIds.push(asset.id)
        setLastUri(uri)
      } catch {
        // skip failed saves
      }
    }
    if (selectedAlbumId !== null && assetIds.length > 0) {
      await addAssetsToAlbum(selectedAlbumId, assetIds)
      const lastId = assetIds[assetIds.length - 1]
      if (lastId !== undefined) await updateAlbumCover(selectedAlbumId, lastId)
    }
    hapticSuccess()
    setBurstCount(0)
  }

  // ── Video ─────────────────────────────────────────────────────────────────────
  async function startRecording(): Promise<void> {
    if (cameraRef.current === null || !cameraReady || !videoModeReady) return
    // Ensure mic permission — on Android this is required for recordAsync
    if (audioPermission !== null && !audioPermission.granted) {
      const result = await requestAudioPermission()
      if (!result.granted) {
        showInfo('Microphone Required', 'Allow microphone access to record video with audio.')
        return
      }
    }
    hapticTap()
    setIsRecording(true)
    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: 300 })
      setIsRecording(false)
      if (result !== undefined && result.uri.length > 0) {
        setLastUri(result.uri)
        const asset = await createAsset(result.uri)
        if (selectedAlbumId !== null) {
          await addAssetsToAlbum(selectedAlbumId, [asset.id])
          await updateAlbumCover(selectedAlbumId, asset.id)
        }
        hapticSuccess()
      }
    } catch (e) {
      setIsRecording(false)
      showInfo('Recording failed', e instanceof Error ? e.message : 'Could not record video.')
    }
  }

  function stopRecording() {
    if (cameraRef.current === null) return
    hapticTap()
    cameraRef.current.stopRecording()
  }

  // ── Shutter handler by mode ───────────────────────────────────────────────────
  function handleShutter() {
    if (timerActive) { cancelTimer(); return }
    switch (mode) {
      case 'photo': startTimerCapture(); break
      case 'video':
        if (isRecording) stopRecording()
        else void startRecording()
        break
      case 'burst': void doBurst(); break
      case 'scan': break // passive scan — no button action
    }
  }

  // ── Album picker ──────────────────────────────────────────────────────────────
  function handleAlbumPick() {
    if (publicAlbums.length === 0) {
      showInfo('No Albums', 'Create an album from the Albums tab first.')
      return
    }
    showSheet({
      title: 'Save to Album',
      actions: [
        { label: 'None', onPress: () => { setSelectedAlbumId(null) } },
        ...publicAlbums.map((a) => ({
          label: a.name + (selectedAlbumId === a.id ? ' ✓' : ''),
          onPress: () => { setSelectedAlbumId(a.id) },
        })),
      ],
    })
  }

  // ── Flash/torch cycle ─────────────────────────────────────────────────────────
  function cycleFlash() {
    if (mode === 'video' || mode === 'scan') {
      setEnableTorch((t) => !t)
    } else {
      const cycle: FlashMode[] = ['off', 'on', 'auto']
      setFlash((f) => cycle[(cycle.indexOf(f) + 1) % cycle.length] ?? 'off')
    }
  }

  const flashIcon = (() => {
    if (mode === 'video' || mode === 'scan') {
      return enableTorch ? 'flashlight' : 'flashlight-outline'
    }
    const icons: Record<FlashMode, React.ComponentProps<typeof Ionicons>['name']> = {
      off: 'flash-off-outline',
      on: 'flash',
      auto: 'flash-outline',
      screen: 'flash-outline', // kept for type safety, never reached
    }
    return icons[flash]
  })()

  // ── Timer cycle ───────────────────────────────────────────────────────────────
  function cycleTimer() {
    const cycle: TimerSetting[] = [0, 3, 10]
    setTimer((t) => cycle[(cycle.indexOf(t) + 1) % cycle.length] ?? 0)
  }

  const timerLabel = timer === 0 ? 'timer-outline' : timer === 3 ? 'timer' : 'timer'
  const timerColor = timer === 0 ? 'rgba(255,255,255,0.7)' : '#FFD60A'

  // ── Camera mode → expo mode prop ──────────────────────────────────────────────
  const cameraMode: CameraMode = mode === 'video' ? 'video' : 'picture'

  // ── Lens selection (iOS optical zoom) ────────────────────────────────────────
  const selectedLens = getIosLens(zoomLevel)

  // ── Permission screens ────────────────────────────────────────────────────────
  if (cameraPermission === null) {
    return (
      <View style={s.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  if (!cameraPermission.granted) {
    return (
      <View style={s.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="camera-outline" size={60} color="rgba(255,255,255,0.3)" style={{ marginBottom: 24 }} />
        <Text style={s.permTitle}>Camera Access Required</Text>
        <Text style={s.permBody}>Allow Gathr to access your camera to take photos and videos.</Text>
        <Pressable style={s.permBtn} onPress={() => { void requestCameraPermission() }}>
          <Text style={s.permBtnText}>Allow Camera</Text>
        </Pressable>
        <Pressable style={s.permClose} onPress={() => { router.back() }} hitSlop={12}>
          <Text style={s.permCloseText}>Not now</Text>
        </Pressable>
      </View>
    )
  }

  const selectedAlbum = publicAlbums.find((a) => a.id === selectedAlbumId)
  const isCapturing = capturing || burstCount > 0

  // ── Shutter visual ────────────────────────────────────────────────────────────
  const shutterInner = (() => {
    if (mode === 'video') {
      return isRecording
        ? <View style={s.shutterStop} />
        : <View style={s.shutterRecDot} />
    }
    if (burstCount > 0) {
      return <Text style={s.burstCount}>{String(burstCount)}</Text>
    }
    return isCapturing
      ? <ActivityIndicator color="#000" size="small" />
      : <View style={s.shutterDot} />
  })()

  const shutterStyle = [
    s.shutter,
    mode === 'video' && isRecording ? s.shutterRecording : null,
  ]

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Viewfinder */}
      <GestureDetector gesture={composed}>
        <View style={StyleSheet.absoluteFill}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
            zoom={zoomValue}
            mode={cameraMode}
            enableTorch={enableTorch}
            animateShutter={false}
            videoStabilizationMode="auto"
            onCameraReady={() => { setCameraReady(true) }}
            onAvailableLensesChanged={handleLensesChanged}
            barcodeScannerSettings={mode === 'scan' ? { barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'pdf417', 'aztec', 'datamatrix'] } : undefined}
            onBarcodeScanned={mode === 'scan' ? (result) => { setScanResult(result.data) } : undefined}
            {...(selectedLens !== undefined ? { selectedLens } : {})}
            {...(Platform.OS === 'android' ? { ratio: '4:3' } : {})}
          />
          {showGrid && <GridOverlay />}
          {focusPoint !== null && (
            <FocusRing x={focusPoint.x} y={focusPoint.y} opacity={focusOpacity} />
          )}
          {timerActive && timerCount > 0 && <TimerOverlay count={timerCount} />}
          {mode === 'scan' && scanResult !== null && (
            <ScanBanner result={scanResult} onDismiss={() => { setScanResult(null) }} />
          )}
        </View>
      </GestureDetector>

      {/* Top bar */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        {/* Close */}
        <Pressable onPress={() => { if (isRecording) stopRecording(); router.back() }} style={({ pressed }) => [s.circleBtn, pressed && s.circleBtnPressed]} hitSlop={12}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>

        {/* Center: recording timer OR album badge */}
        <View style={s.topCenter}>
          {isRecording ? (
            <View style={s.recBadge}>
              <View style={s.recDot} />
              <Text style={s.recTimer}>{recordingTimer}</Text>
            </View>
          ) : selectedAlbum !== undefined ? (
            <View style={s.albumBadge}>
              <Ionicons name="albums-outline" size={12} color="#fff" />
              <Text style={s.albumBadgeText} numberOfLines={1}>{selectedAlbum.name}</Text>
            </View>
          ) : null}
        </View>

        {/* Top right: controls row */}
        <View style={s.topRight}>
          {/* Grid toggle */}
          <Pressable onPress={() => { setShowGrid((g) => !g) }} style={({ pressed }) => [s.iconBtn, pressed && s.iconBtnPressed]} hitSlop={10}>
            <Ionicons
              name={showGrid ? 'grid' : 'grid-outline'}
              size={18}
              color={showGrid ? '#FFD60A' : '#fff'}
            />
          </Pressable>
          {/* Timer (photo + burst modes only) */}
          {(mode === 'photo' || mode === 'burst') && (
            <Pressable onPress={cycleTimer} style={({ pressed }) => [s.iconBtn, pressed && s.iconBtnPressed]} hitSlop={10}>
              <Ionicons name={timerLabel} size={18} color={timerColor} />
              {timer > 0 && <Text style={s.timerBadge}>{String(timer)}</Text>}
            </Pressable>
          )}
          {/* Flash / torch */}
          <Pressable onPress={cycleFlash} style={({ pressed }) => [s.iconBtn, pressed && s.iconBtnPressed]} hitSlop={10}>
            <Ionicons name={flashIcon} size={20} color={flash !== 'off' || enableTorch ? '#FFD60A' : '#fff'} />
          </Pressable>
        </View>
      </View>

      {/* Live zoom ratio — visible only while pinching */}
      {isPinching && (
        <View style={s.zoomIndicator} pointerEvents="none">
          <Text style={s.zoomIndicatorText}>{zoomValueToLabel(zoomValue)}</Text>
        </View>
      )}

      {/* Zoom level selector */}
      <View style={s.zoomBar}>
        {ZOOM_LEVELS.map((level) => {
          const isActive = level === zoomLevel
          // 0.5× is optical on iOS (ultrawide lens); Android has no lens-switch API
          const unavailable = level === 0.5 && (Platform.OS !== 'ios' || !hasUltrawide)
          if (unavailable) return null
          return (
            <Pressable
              key={level}
              onPress={() => { selectZoomLevel(level) }}
              style={({ pressed }) => [s.zoomBtn, isActive && s.zoomBtnActive, pressed && s.zoomBtnPressed]}
              hitSlop={6}
            >
              <Text style={[s.zoomBtnText, isActive && s.zoomBtnTextActive]}>
                {level === 0.5 ? '0.5×' : `${String(level)}×`}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Mode carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.modeScroll}
        style={s.modeBar}
        bounces={false}
      >
        {MODES.map(({ key, label }) => {
          const isActive = key === mode
          return (
            <Pressable
              key={key}
              onPress={() => {
                if (isRecording) return
                setMode(key)
                setScanResult(null)
              }}
              style={({ pressed }) => [s.modeItem, pressed && s.modeItemPressed]}
              hitSlop={8}
            >
              <Text style={[s.modeText, isActive && s.modeTextActive]}>{label}</Text>
              {isActive && <View style={s.modeDot} />}
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Bottom bar */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {/* Thumbnail / album picker */}
        <Pressable onPress={handleAlbumPick} style={({ pressed }) => [s.thumbSlot, pressed && s.thumbSlotPressed]} hitSlop={8}>
          {lastUri !== null ? (
            <Image source={{ uri: lastUri }} style={s.thumb} contentFit="cover" transition={120} />
          ) : (
            <View style={s.thumbEmpty}>
              <Ionicons name="albums-outline" size={18} color="rgba(255,255,255,0.6)" />
            </View>
          )}
          {burstCount > 0 && (
            <View style={s.burstBadge}>
              <Text style={s.burstBadgeText}>{String(burstCount)}</Text>
            </View>
          )}
        </Pressable>

        {/* Shutter */}
        <Pressable
          onPress={handleShutter}
          style={shutterStyle}
          disabled={mode === 'scan' || (isCapturing && mode !== 'video') || (mode === 'video' && !videoModeReady && !isRecording)}
        >
          {shutterInner}
        </Pressable>

        {/* Flip camera */}
        <Pressable
          onPress={() => { if (!isRecording) setFacing((f) => (f === 'back' ? 'front' : 'back')) }}
          style={({ pressed }) => [s.circleBtn, pressed && s.circleBtnPressed, isRecording && s.disabledBtn]}
          hitSlop={12}
          disabled={isRecording}
        >
          <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
        </Pressable>
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  circleBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  timerBadge: {
    position: 'absolute',
    right: -2,
    top: -2,
    fontSize: 9,
    fontWeight: '700',
    color: '#FFD60A',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 2,
  },

  // Recording badge
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF3B30',
  },
  recTimer: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },

  // Album badge
  albumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    maxWidth: 160,
  },
  albumBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },

  // Zoom bar
  zoomIndicator: {
    position: 'absolute',
    bottom: 258,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  zoomIndicatorText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFD60A',
    letterSpacing: 0.3,
  },
  zoomBar: {
    position: 'absolute',
    bottom: 210,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  zoomBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  zoomBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  zoomBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  zoomBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  zoomBtnTextActive: {
    color: '#FFD60A',
  },

  // Mode bar
  modeBar: {
    position: 'absolute',
    bottom: 155,
    left: 0,
    right: 0,
  },
  modeScroll: {
    paddingHorizontal: SCREEN_W / 2 - 60,
    gap: 28,
    alignItems: 'center',
  },
  modeItem: {
    alignItems: 'center',
    gap: 4,
  },
  modeItemPressed: {
    opacity: 0.6,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.8,
  },
  modeTextActive: {
    color: '#FFD60A',
  },
  modeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFD60A',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingTop: 16,
  },

  // Thumbnail
  thumbSlot: {
    width: 54,
    height: 54,
    borderRadius: 12,
    overflow: 'visible',
  },
  thumbSlotPressed: {
    opacity: 0.7,
  },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  thumbEmpty: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  burstBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#0A84FF',
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  // Shutter
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  shutterRecording: {
    backgroundColor: '#FF3B30',
    borderColor: 'rgba(255,59,48,0.35)',
  },
  shutterDot: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  shutterRecDot: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  shutterStop: {
    width: 28,
    height: 28,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  burstCount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000',
  },
  disabledBtn: {
    opacity: 0.3,
  },

  // Permission screens
  permTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  permBody: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  permBtn: {
    backgroundColor: '#0A84FF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  permBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  permClose: { padding: 8 },
  permCloseText: { color: 'rgba(255,255,255,0.5)', fontSize: 15 },
})
