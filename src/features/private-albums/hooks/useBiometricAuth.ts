import { useCallback, useEffect, useState } from 'react'
import {
  authenticate as biometricAuthenticate,
  getBiometricType,
  isBiometricAvailable,
} from '@/lib/biometrics'

type BiometricType = 'fingerprint' | 'face' | 'iris' | 'none'

const DEFAULT_REASON = 'Authenticate to access your private album'

interface BiometricAuthState {
  isAuthenticated: boolean
  isAuthenticating: boolean
  biometricType: BiometricType
  isAvailable: boolean
  authenticate: (reason?: string) => Promise<boolean>
  lock: () => void
}

export function useBiometricAuth(): BiometricAuthState {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [biometricType, setBiometricType] = useState<BiometricType>('none')
  const [isAvailable, setIsAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.all([isBiometricAvailable(), getBiometricType()]).then(([available, type]) => {
      if (cancelled) return
      setIsAvailable(available)
      setBiometricType(type)
    })
    return () => {
      cancelled = true
      setIsAuthenticated(false)
    }
  }, [])

  const authenticate = useCallback(async (reason?: string): Promise<boolean> => {
    setIsAuthenticating(true)
    try {
      const success = await biometricAuthenticate(reason ?? DEFAULT_REASON)
      if (success) setIsAuthenticated(true)
      return success
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  const lock = useCallback(() => {
    setIsAuthenticated(false)
  }, [])

  return { isAuthenticated, isAuthenticating, biometricType, isAvailable, authenticate, lock }
}
