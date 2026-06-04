import { useRef } from 'react'
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { type StoredTrip } from '@/lib/db'
import { type MediaLibraryAsset } from '@/lib/mediaLibrary'

const AC = '#A488BE'
const FG = '#FFFFFF'
const FG2 = 'rgba(235,235,245,0.55)'
const CARD_BODY_BG = '#0C0C0E'

interface Props {
  trip: StoredTrip
  coverAsset: MediaLibraryAsset | undefined
  onPress: () => void
  onSaveAsAlbum?: () => void
  isSavingAlbum?: boolean
  inAlbums?: boolean
  large?: boolean
}

function assetUri(asset: MediaLibraryAsset): string {
  return Platform.OS === 'ios' ? `ph://${asset.id}` : asset.id
}

export function TripCard({
  trip,
  coverAsset,
  onPress,
  onSaveAsAlbum,
  isSavingAlbum = false,
  inAlbums = false,
  large = false,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 5 }).start()
  }

  const coverH = large ? 200 : 160
  const topRadius = large ? 16 : 12

  const metaText = `${trip.subtitle} · ${String(trip.photoCount)} photos`

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {/* Cover image */}
        <View style={[styles.cover, { height: coverH, borderTopLeftRadius: topRadius, borderTopRightRadius: topRadius }]}>
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

          {/* Subtle top-to-transparent darken for readability */}
          <View style={styles.topFade} pointerEvents="none" />

          {/* Save as Album pill */}
          {onSaveAsAlbum !== undefined && !inAlbums && (
            <Pressable
              style={styles.savePill}
              onPress={onSaveAsAlbum}
              hitSlop={8}
            >
              <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
              {isSavingAlbum ? (
                <ActivityIndicator size="small" color={AC} style={{ marginHorizontal: 2 }} />
              ) : (
                <>
                  <Ionicons name="bookmark-outline" size={12} color={AC} />
                  <Text style={styles.savePillText}>Save as Album</Text>
                </>
              )}
            </Pressable>
          )}

          {/* In Albums badge */}
          {inAlbums && (
            <View style={styles.inAlbumsBadge}>
              <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.inAlbumsCheck}>
                <Ionicons name="checkmark" size={9} color={FG} />
              </View>
              <Text style={styles.inAlbumsText}>In Albums</Text>
            </View>
          )}
        </View>

        {/* Card body */}
        <View style={styles.body}>
          <Text
            style={[styles.name, large ? styles.nameLarge : styles.nameSmall]}
            numberOfLines={1}
          >
            {trip.label}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {metaText}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  cover: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#1A1A1E',
  },
  placeholder: {
    backgroundColor: '#1A1A1E',
  },
  topFade: {
    ...StyleSheet.absoluteFillObject,
    // Subtle top-darken + bottom-darken (no text here, just depth)
    backgroundColor: 'transparent',
  },
  savePill: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 8,
    paddingRight: 10,
  },
  savePillText: {
    color: AC,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  inAlbumsBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  inAlbumsCheck: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: AC,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inAlbumsText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '400',
  },
  body: {
    backgroundColor: CARD_BODY_BG,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
  },
  name: {
    color: FG,
    marginBottom: 4,
  },
  nameLarge: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginTop: 14,
  },
  nameSmall: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
    marginTop: 11,
  },
  meta: {
    color: FG2,
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 14,
  },
})
