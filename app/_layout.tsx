import { useEffect, useState } from 'react'
import { Platform, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { initDb } from '@/lib/db'
import { ThemeProvider, useTheme } from '@/lib/themeContext'
import { UndoToastProvider } from '@/components/ui/UndoToast'
import { useTrashStore } from '@/store/trashStore'
import { hasCompletedOnboarding } from '@/lib/onboarding'

function AppStack() {
  const { isDark, colors } = useTheme()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void hasCompletedOnboarding().then((done) => {
      if (!done) router.replace('/onboarding')
      setReady(true)
    })
  }, [])

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.background }} />

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text, fontWeight: '600' },
          headerShadowVisible: false,
          // iOS: blurred glass header matching theme
          headerBlurEffect: isDark ? 'dark' : 'light',
          headerTransparent: Platform.OS === 'ios',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="camera" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="duplicates" options={{ title: 'Similar Photos', presentation: 'modal' }} />
        <Stack.Screen name="trash" options={{ title: 'Recently Deleted' }} />
        <Stack.Screen name="memory/[id]" options={{ title: 'Memory' }} />
        <Stack.Screen name="people/[id]" options={{ title: 'Person' }} />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  useEffect(() => {
    void initDb()
    void useTrashStore.getState().loadTrash().then(() => {
      void useTrashStore.getState().purgeExpired()
    })
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <SafeAreaProvider>
          <UndoToastProvider>
            <AppStack />
          </UndoToastProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
