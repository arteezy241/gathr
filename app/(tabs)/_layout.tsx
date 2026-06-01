import { Tabs } from 'expo-router'
import { FloatingTabBar } from '@/components/ui/FloatingTabBar'

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Photos' }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips' }} />
      <Tabs.Screen name="albums" options={{ title: 'Albums' }} />
      <Tabs.Screen name="people" options={{ title: 'People' }} />
    </Tabs>
  )
}
