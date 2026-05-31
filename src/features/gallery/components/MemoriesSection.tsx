import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useMemoriesStore } from '@/store/memoriesStore'
import { useTheme } from '@/lib/themeContext'
import { Skeleton } from '@/components/ui/Skeleton'
import { radius, typography } from '@/lib/theme'
import { MemoryCard } from './MemoryCard'

const CARD_W = 220
const CARD_H = 150

export function MemoriesSection() {
  const router = useRouter()
  const { colors } = useTheme()
  const { memories, isLoading } = useMemoriesStore()

  if (!isLoading && memories.length === 0) return null

  function handlePress(memoryId: string) {
    const memory = memories.find((m) => m.id === memoryId)
    if (memory === undefined) return

    if (memory.type === 'tripMemory' && memory.tripId !== undefined) {
      router.push(`/trip/${memory.tripId}`)
    } else {
      router.push(`/memory/${memory.id}`)
    }
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.text }]}>Memories</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {isLoading ? (
          <>
            <Skeleton width={CARD_W} height={CARD_H} borderRadius={radius.lg} />
            <Skeleton width={CARD_W} height={CARD_H} borderRadius={radius.lg} />
          </>
        ) : (
          memories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onPress={() => { handlePress(memory.id) }}
            />
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 4,
  },
  title: {
    ...typography.headline,
    fontSize: 20,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
})
