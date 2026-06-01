import { useMemo, useRef } from 'react'
import { ActivityIndicator, Animated, Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { type StoredTrip } from '@/lib/db'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'
import { useTheme } from '@/lib/themeContext'
import { GlassView } from '@/components/ui/GlassView'
import { radius, spacing, typography, type ThemeColors } from '@/lib/theme'

interface Props {
  trip: StoredTrip
  coverAsset: MediaLibraryAsset | undefined
  onPress: () => void
  onSaveAsAlbum?: () => void
  isSavingAlbum?: boolean
}

const CARD_WIDTH = Dimensions.get('window').width - 32
const CARD_HEIGHT = 200

function assetUri(asset: MediaLibraryAsset): string {
  return Platform.OS === 'ios' ? `ph://${asset.id}` : asset.id
}

export function TripCard({ trip, coverAsset, onPress, onSaveAsAlbum, isSavingAlbum = false }: Props) {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const scale = useRef(new Animated.Value(1)).current

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 5 }).start()
  }

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
      {coverAsset !== undefined ? (
        <Image
          source={{ uri: assetUri(coverAsset) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={coverAsset.id}
          transition={200}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
      )}
      <GlassView intensity={50} tint="dark" style={styles.gradient}>
        <Text style={styles.label} numberOfLines={1}>
          {trip.label}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {trip.subtitle}
        </Text>
      </GlassView>
      {onSaveAsAlbum !== undefined && (
        <Pressable
          style={styles.saveAlbumBtn}
          onPress={onSaveAsAlbum}
          hitSlop={8}
        >
          {isSavingAlbum ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="albums-outline" size={12} color="#fff" />
              <Text style={styles.saveAlbumText}>Save as Album</Text>
            </>
          )}
        </Pressable>
      )}
      </Animated.View>
    </Pressable>
  )
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.surfaceElevated,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
      elevation: 6,
    },
    placeholder: {
      backgroundColor: colors.surfaceElevated,
    },
    gradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 100,
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    label: {
      ...typography.headline,
      fontSize: 20,
      color: '#FFFFFF',
      marginBottom: spacing.xs,
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    subtitle: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.85)',
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    saveAlbumBtn: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(0,0,0,0.52)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
    },
    saveAlbumText: {
      fontSize: 11,
      fontWeight: '600' as const,
      color: '#fff',
    },
  })
}
