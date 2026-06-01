import { createImageFaceDetector } from 'react-native-vision-camera-face-detector'
import type { Landmarks } from 'react-native-vision-camera-face-detector'

export interface DetectedFace {
  // NOTE: embedding is normalized landmark coords, NOT a semantic face embedding.
  // ML Kit provides named landmark positions (eyes, nose, mouth corners, cheeks, ears).
  // We flatten them and normalize each coordinate to 0–1 relative to the face bbox.
  // Clustering accuracy degrades with large pose/lighting variation — acceptable for MVP.
  embedding: number[]
  bbox: { x: number; y: number; w: number; h: number }
}

// Singleton detector — created once and reused across all detectFacesInAsset calls.
let _detector: ReturnType<typeof createImageFaceDetector> | null = null

function getDetector(): ReturnType<typeof createImageFaceDetector> {
  if (_detector === null) {
    _detector = createImageFaceDetector({ performanceMode: 'fast', runLandmarks: true })
  }
  return _detector
}

const LANDMARK_KEYS: ReadonlyArray<keyof Landmarks> = [
  'LEFT_EYE', 'RIGHT_EYE', 'NOSE_BASE',
  'MOUTH_LEFT', 'MOUTH_RIGHT', 'MOUTH_BOTTOM',
  'LEFT_CHEEK', 'RIGHT_CHEEK', 'LEFT_EAR', 'RIGHT_EAR',
]

// Always emit exactly LANDMARK_KEYS.length * 2 floats — zero-pad missing landmarks so all
// vectors are the same length regardless of how many landmarks ML Kit detected in a given pose.
function flattenLandmarks(landmarks: Landmarks, bx: number, by: number, bw: number, bh: number): number[] {
  const pts: number[] = []
  for (const key of LANDMARK_KEYS) {
    const pt = landmarks[key]
    pts.push(
      pt !== undefined && bw > 0 ? (pt.x - bx) / bw : 0,
      pt !== undefined && bh > 0 ? (pt.y - by) / bh : 0,
    )
  }
  return pts  // always LANDMARK_KEYS.length * 2 = 20 floats
}

export function detectFacesInAsset(assetUri: string): Promise<DetectedFace[]> {
  if (!assetUri) return Promise.resolve([])
  try {
    const detector = getDetector()
    const faces = detector.detectFaces({ uri: assetUri })
    const results = faces
      .map((face) => {
        const { x: bx, y: by, width: bw, height: bh } = face.bounds
        if (!face.landmarks) return null
        const pts = flattenLandmarks(face.landmarks, bx, by, bw, bh)
        return { embedding: pts, bbox: { x: bx, y: by, w: bw, h: bh } }
      })
      .filter((f): f is DetectedFace => f !== null)
    return Promise.resolve(results)
  } catch {
    return Promise.resolve([])
  }
}
