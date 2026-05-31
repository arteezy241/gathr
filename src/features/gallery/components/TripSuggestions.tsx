import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useTripSuggestionStore } from '@/store/tripSuggestionStore'
import { useTheme } from '@/lib/themeContext'
import { GlassView } from '@/components/ui/GlassView'
import { hapticSuccess, hapticTap } from '@/lib/haptics'
import { radius, spacing, typography } from '@/lib/theme'

const CARD_W = 280
const CARD_H = 120

function coverUri(id: string): string {
  return Platform.OS === 'ios' ? `ph://${id}` : id
}

export function TripSuggestions() {
  const { colors } = useTheme()
  const { suggestions, saving, saveSuggestionAsAlbum, dismiss } = useTripSuggestionStore()

  if (suggestions.length === 0) return null

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={16} color={colors.accent} />
        <Text style={[styles.title, { color: colors.text }]}>Save as Album?</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {suggestions.map(({ trip }) => {
          const isSaving = saving === trip.id
          return (
            <View key={trip.id} style={[styles.card, { backgroundColor: colors.surface }]}>
              {/* Cover photo */}
              <Image
                source={{ uri: coverUri(trip.coverAssetId) }}
                style={styles.cover}
                contentFit="cover"
                transition={200}
              />

              {/* Info overlay */}
              <GlassView intensity={60} tint="dark" style={styles.overlay}>
                <Text style={styles.label} numberOfLines={1}>{trip.label}</Text>
                <Text style={styles.sub} numberOfLines={1}>{trip.subtitle}</Text>
              </GlassView>

              {/* Dismiss button */}
              <Pressable
                style={styles.dismissBtn}
                onPress={() => { hapticTap(); void dismiss(trip.id) }}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.85)" />
              </Pressable>

              {/* Save button */}
              <Pressable
                style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                onPress={() => {
                  hapticSuccess()
                  void saveSuggestionAsAlbum({ trip })
                }}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="albums-outline" size={14} color="#fff" />
                    <Text style={styles.saveBtnText}>Save as Album</Text>
                  </>
                )}
              </Pressable>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  title: {
    ...typography.bodyMedium,
    fontSize: 15,
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  cover: {
    ...StyleSheet.absoluteFill,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  label: {
    ...typography.bodyMedium,
    fontSize: 14,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  sub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dismissBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  saveBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 44,
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
})
