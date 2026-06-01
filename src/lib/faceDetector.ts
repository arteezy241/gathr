import FaceDetection, {
  type LandmarkType,
  type Landmark,
} from '@react-native-ml-kit/face-detection'

export interface DetectedFace {
  // NOTE: embedding is normalized landmark coords, NOT a semantic face embedding.
  // ML Kit provides named landmark positions (eyes, nose, mouth corners, cheeks, ears).
  // We flatten them and normalize each coordinate to 0–1 relative to the face bbox.
  // Clustering accuracy degrades with large pose/lighting variation — acceptable for MVP.
  embedding: number[]
  bbox: { x: number; y: number; w: number; h: number }
}

const LANDMARK_KEYS: ReadonlyArray<LandmarkType> = [
  'leftEye', 'rightEye', 'noseBase',
  'mouthLeft', 'mouthRight', 'mouthBottom',
  'leftCheek', 'rightCheek', 'leftEar', 'rightEar',
]

// Always emit exactly LANDMARK_KEYS.length * 2 floats — zero-pad missing landmarks so all
// vectors are the same length regardless of how many landmarks ML Kit detected in a given pose.
function flattenLandmarks(
  landmarks: Record<LandmarkType, Landmark>,
  bx: number, by: number, bw: number, bh: number,
): number[] {
  const pts: number[] = []
  for (const key of LANDMARK_KEYS) {
    const { x, y } = landmarks[key].position
    pts.push(
      bw > 0 ? (x - bx) / bw : 0,
      bh > 0 ? (y - by) / bh : 0,
    )
  }
  return pts // always LANDMARK_KEYS.length * 2 = 20 floats
}

export async function detectFacesInAsset(assetUri: string): Promise<DetectedFace[]> {
  if (!assetUri) return []
  try {
    const faces = await FaceDetection.detect(assetUri, {
      performanceMode: 'fast',
      landmarkMode: 'all',
    })
    return faces
      .map((face) => {
        if (!face.landmarks) return null
        const { left: bx, top: by, width: bw, height: bh } = face.frame
        return {
          embedding: flattenLandmarks(face.landmarks, bx, by, bw, bh),
          bbox: { x: bx, y: by, w: bw, h: bh },
        }
      })
      .filter((f): f is DetectedFace => f !== null)
  } catch {
    return []
  }
}
