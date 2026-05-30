import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSelectionStore } from '@/store/selectionStore'

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
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'images-sharp' : 'images'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="albums"
        options={{
          title: 'Albums',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'albums-sharp' : 'albums'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
