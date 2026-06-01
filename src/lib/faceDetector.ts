import { Platform } from 'react-native'
import FaceDetection from '@react-native-ml-kit/face-detection'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import type { TfliteModel, TensorflowModelDelegate } from 'react-native-fast-tflite'
import * as jpeg from 'jpeg-js'

export interface DetectedFace {
  embedding: number[]   // 192-d L2-normalized MobileFaceNet embedding
  bbox: { x: number; y: number; w: number; h: number }
}

// Must match MobileFaceNet input: [1, 112, 112, 3], output: [1, 192]
export const EMBEDDING_LENGTH = 192
const FACE_SIZE = 112
const BBOX_PAD = 0.25

// Promise-based singleton — null if the native module isn't available yet (needs rebuild)
let _modelPromise: Promise<TfliteModel | null> | null = null

function getModel(): Promise<TfliteModel | null> {
  if (_modelPromise === null) {
    _modelPromise = (async () => {
      try {
        // Lazy require so a missing native module doesn't crash the app at import time.
        // The native module only exists after a custom dev/production build.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { loadTensorflowModel } = require('react-native-fast-tflite') as {
          loadTensorflowModel: (source: number, delegates?: TensorflowModelDelegate[]) => Promise<TfliteModel>
        }
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const src = require('../../assets/models/mobile_face_net.tflite') as number
        const delegates: TensorflowModelDelegate[] = Platform.OS === 'ios' ? ['core-ml'] : []
        try {
          return await loadTensorflowModel(src, delegates)
        } catch {
          // Core ML may reject some model architectures — fall back to CPU
          return await loadTensorflowModel(src, [])
        }
      } catch {
        // Native module not yet compiled into this build — scan will find no faces
        return null
      }
    })()
  }
  return _modelPromise
}

// Decode base64 JPEG → Float32Array normalized to [-1, 1], NHWC layout [112*112*3]
function jpegBase64ToFloat32(base64: string): Float32Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i) & 0xff
  }
  const { data: rgba } = jpeg.decode(bytes, { useTArray: true })
  const float32 = new Float32Array(FACE_SIZE * FACE_SIZE * 3)
  for (let i = 0; i < FACE_SIZE * FACE_SIZE; i++) {
    const base = i * 4
    float32[i * 3]     = ((rgba[base] ?? 0) / 127.5) - 1.0
    float32[i * 3 + 1] = ((rgba[base + 1] ?? 0) / 127.5) - 1.0
    float32[i * 3 + 2] = ((rgba[base + 2] ?? 0) / 127.5) - 1.0
  }
  return float32
}

function l2Normalize(buffer: ArrayBuffer): number[] {
  const vec = new Float32Array(buffer)
  let norm = 0
  for (const v of vec) norm += v * v
  norm = Math.sqrt(norm)
  if (norm === 0) return Array.from(vec)
  return Array.from(vec, (v) => v / norm)
}

export async function detectFacesInAsset(assetUri: string): Promise<DetectedFace[]> {
  if (!assetUri) return []
  try {
    const model = await getModel()
    if (model === null) return []   // native module not available yet

    const faces = await FaceDetection.detect(assetUri, {
      performanceMode: 'fast',
      landmarkMode: 'none',
    })

    if (faces.length === 0) return []

    const results: DetectedFace[] = []

    for (const face of faces) {
      try {
        const { left: bx, top: by, width: bw, height: bh } = face.frame

        if (bw < 40 || bh < 40) continue

        const padX = bw * BBOX_PAD
        const padY = bh * BBOX_PAD
        const cropX = Math.max(0, bx - padX)
        const cropY = Math.max(0, by - padY)
        const cropW = bw + padX * 2
        const cropH = bh + padY * 2

        const imageRef = await ImageManipulator.manipulate(assetUri)
          .crop({ originX: cropX, originY: cropY, width: cropW, height: cropH })
          .resize({ width: FACE_SIZE, height: FACE_SIZE })
          .renderAsync()
        const { base64 } = await imageRef.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: 0.92 })

        if (!base64) continue

        const inputFloat32 = jpegBase64ToFloat32(base64)
        const [rawOutput] = await model.run([inputFloat32.buffer as ArrayBuffer])
        if (!rawOutput) continue

        const embedding = l2Normalize(rawOutput)
        if (embedding.length !== EMBEDDING_LENGTH) {
          if (__DEV__) {
            console.warn(`[faceDetector] model output ${String(embedding.length)}-d, expected ${String(EMBEDDING_LENGTH)}-d — update EMBEDDING_LENGTH to match.`)
          }
          continue
        }

        results.push({ embedding, bbox: { x: bx, y: by, w: bw, h: bh } })
      } catch {
        // Skip faces that fail preprocessing or inference
      }
    }

    return results
  } catch {
    return []
  }
}
