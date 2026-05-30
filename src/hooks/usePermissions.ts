import { useCallback, useEffect, useState } from 'react'
import { getPermissions, requestPermissions } from '@/lib/mediaLibrary'

interface PermissionsState {
  granted: boolean
  requesting: boolean
  request: () => Promise<void>
}

export function usePermissions(): PermissionsState {
  const [granted, setGranted] = useState(false)
  const [requesting, setRequesting] = useState(true)

  useEffect(() => {
    let cancelled = false

    void getPermissions().then((response) => {
      if (!cancelled) {
        setGranted(response.granted)
        setRequesting(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  const request = useCallback(async () => {
    setRequesting(true)
    try {
      const response = await requestPermissions()
      setGranted(response.granted)
    } finally {
      setRequesting(false)
    }
  }, [])

  return { granted, requesting, request }
}
