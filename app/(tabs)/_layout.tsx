import { Text } from 'react-native'
import { Tabs } from 'expo-router'
import { useSelectionStore } from '@/store/selectionStore'

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>
}

export default function TabsLayout() {
  const isSelecting = useSelectionStore((s) => s.isSelecting)

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: isSelecting ? { display: 'none' } : undefined,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Photos',
          tabBarIcon: () => <TabIcon emoji="📷" />,
        }}
      />
      <Tabs.Screen
        name="albums"
        options={{
          title: 'Albums',
          tabBarIcon: () => <TabIcon emoji="🗂️" />,
        }}
      />
    </Tabs>
  )
}
