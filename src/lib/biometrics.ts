import {
  AuthenticationType,
  authenticateAsync,
  hasHardwareAsync,
  isEnrolledAsync,
  supportedAuthenticationTypesAsync,
} from 'expo-local-authentication'

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const [hardware, enrolled] = await Promise.all([hasHardwareAsync(), isEnrolledAsync()])
    return hardware && enrolled
  } catch {
    return false
  }
}

export async function authenticate(reason: string): Promise<boolean> {
  try {
    const result = await authenticateAsync({
      promptMessage: reason,
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    })
    return result.success
  } catch {
    return false
  }
}

export async function getBiometricType(): Promise<'fingerprint' | 'face' | 'iris' | 'none'> {
  try {
    const types = await supportedAuthenticationTypesAsync()
    if (types.includes(AuthenticationType.FACIAL_RECOGNITION)) return 'face'
    if (types.includes(AuthenticationType.FINGERPRINT)) return 'fingerprint'
    if (types.includes(AuthenticationType.IRIS)) return 'iris'
    return 'none'
  } catch {
    return 'none'
  }
}
