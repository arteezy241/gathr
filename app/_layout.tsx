import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { initDb } from '@/lib/db'

export default function RootLayout() {
  useEffect(() => {
    void initDb()
  }, [])

  return (
    <SafeAreaProvider>
      <Stack />
    </SafeAreaProvider>
  )
}
