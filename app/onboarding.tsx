import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Skeleton } from '@/components/ui/Skeleton'
import { useTheme } from '@/lib/themeContext'
import { usePermissions } from '@/hooks/usePermissions'
import { markOnboardingComplete } from '@/lib/onboarding'
import { radius, spacing, typography } from '@/lib/theme'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const SLIDE_COUNT = 4
const SLIDES = [0, 1, 2, 3]
const MOSAIC_OUTER = SCREEN_WIDTH - 2 * 40
const CELL_SIZE = Math.floor((MOSAIC_OUTER - 2 * 6) / 3)

// ── Slide illustrations ───────────────────────────────────────────────────────

function WelcomeMosaic() {
  return (
    <View style={styles.mosaic}>
      {SLIDES.concat([4, 5, 6, 7, 8]).map((i) => (
        <Skeleton key={i} width={CELL_SIZE} height={CELL_SIZE} borderRadius={8} />
      ))}
    </View>
  )
}

function TripsIllustration({ stroke }: { stroke: string }) {
  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      {/* Location pin: teardrop outline */}
      <Path
        d="M60 12 C40 12 24 28 24 48 C24 70 60 108 60 108 C60 108 96 70 96 48 C96 28 80 12 60 12 Z"
        stroke={stroke} strokeWidth="2.5" fill="none" strokeLinejoin="round"
      />
      {/* Calendar rect inside pin */}
      <Rect x="46" y="33" width="28" height="22" rx="3" stroke={stroke} strokeWidth="2" fill="none" />
      {/* Calendar header line + pin rings */}
      <Line x1="46" y1="40" x2="74" y2="40" stroke={stroke} strokeWidth="2" />
    </Svg>
  )
}

function LockIllustration({ stroke }: { stroke: string }) {
  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      {/* Shackle */}
      <Path
        d="M42 62 L42 46 Q42 28 60 28 Q78 28 78 46 L78 62"
        stroke={stroke} strokeWidth="2.5" fill="none" strokeLinecap="round"
      />
      {/* Body */}
      <Rect x="32" y="60" width="56" height="46" rx="8" stroke={stroke} strokeWidth="2.5" fill="none" />
      {/* Keyhole */}
      <Circle cx="60" cy="82" r="6" stroke={stroke} strokeWidth="2.5" fill="none" />
      <Line x1="60" y1="88" x2="60" y2="96" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  )
}

// ── Onboarding screen ─────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { request } = usePermissions()

  const flatListRef = useRef<FlatList<number>>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Dot widths: active = 24, inactive = 8
  const dotWidths = useRef(
    SLIDES.map((i) => new Animated.Value(i === 0 ? 24 : 8)),
  ).current

  useEffect(() => {
    Animated.parallel(
      dotWidths.map((w, i) =>
        Animated.spring(w, {
          toValue: i === currentIndex ? 24 : 8,
          useNativeDriver: false,
          speed: 20,
          bounciness: 0,
        }),
      ),
    ).start()
  }, [currentIndex, dotWidths])

  // Must be stable — React Native warns if this prop changes
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0]
      if (first?.index != null) setCurrentIndex(first.index)
    },
  ).current

  function handleNext() {
    flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true })
  }

  async function handleSkip() {
    await markOnboardingComplete()
    router.replace('/(tabs)')
  }

  async function handleAllowAccess() {
    await request()
    await markOnboardingComplete()
    router.replace('/(tabs)')
  }

  async function handleNotNow() {
    await markOnboardingComplete()
    router.replace('/(tabs)')
  }

  const renderSlide = useCallback(({ item }: { item: number }) => {
    return (
      <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
        <SlideContent index={item} strokeColor={colors.textSecondary} textColor={colors.text} bodyColor={colors.textSecondary} />
      </View>
    )
  }, [colors.textSecondary, colors.text])

  const keyExtractor = useCallback((item: number) => String(item), [])
  const getItemLayout = useCallback(
    (_: ArrayLike<number> | null | undefined, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    [],
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Skip button — hidden on last slide */}
      {currentIndex < 3 && (
        <Pressable
          style={[styles.skipBtn, { top: insets.top + 16 }]}
          onPress={() => { void handleSkip() }}
          hitSlop={12}
        >
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
        </Pressable>
      )}

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={renderSlide}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={styles.flatList}
        bounces={false}
      />

      {/* Bottom section: dots + CTA */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}>
        <View style={styles.dotsRow}>
          {dotWidths.map((w, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  width: w,
                  backgroundColor: i === currentIndex ? colors.accent : colors.textTertiary,
                },
              ]}
            />
          ))}
        </View>

        {currentIndex === 3 ? (
          <View style={styles.ctaStack}>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
              onPress={() => { void handleAllowAccess() }}
            >
              <Text style={styles.primaryBtnText}>Allow Access</Text>
            </Pressable>
            <Pressable
              style={[styles.ghostBtn, { borderColor: colors.border }]}
              onPress={() => { void handleNotNow() }}
            >
              <Text style={[styles.ghostBtnText, { color: colors.textSecondary }]}>Not Now</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.nextBtn} onPress={handleNext} hitSlop={12}>
            <Text style={[styles.nextBtnText, { color: colors.accent }]}>Next →</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

// ── Slide content component ───────────────────────────────────────────────────

interface SlideContentProps {
  index: number
  strokeColor: string
  textColor: string
  bodyColor: string
}

function SlideContent({ index, strokeColor, textColor, bodyColor }: SlideContentProps) {
  switch (index) {
    case 0:
      return (
        <View style={styles.slideInner}>
          <WelcomeMosaic />
          <Text style={[styles.wordmark, { color: textColor }]}>Gathr</Text>
          <Text style={[styles.subtitle, { color: bodyColor }]}>
            Your photos, beautifully organized.
          </Text>
        </View>
      )
    case 1:
      return (
        <View style={styles.slideInner}>
          <TripsIllustration stroke={strokeColor} />
          <Text style={[styles.slideHeading, { color: textColor }]}>Trips & Memories</Text>
          <Text style={[styles.slideBody, { color: bodyColor }]}>
            Gathr automatically groups your photos by time and place — no tagging needed.
          </Text>
        </View>
      )
    case 2:
      return (
        <View style={styles.slideInner}>
          <LockIllustration stroke={strokeColor} />
          <Text style={[styles.slideHeading, { color: textColor }]}>Private Albums</Text>
          <Text style={[styles.slideBody, { color: bodyColor }]}>
            Lock albums with Face ID or fingerprint. Your private moments stay private.
          </Text>
        </View>
      )
    case 3:
      return (
        <View style={styles.slideInner}>
          <Text style={[styles.slideHeading, { color: textColor }]}>Allow access to your photos</Text>
          <Text style={[styles.slideBody, { color: bodyColor }]}>
            Gathr needs access to organize your library. We never upload your photos anywhere.
          </Text>
        </View>
      )
    default:
      return null
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipText: {
    ...typography.body,
    fontWeight: '500',
  },
  flatList: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideInner: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: spacing.md,
    maxWidth: 400,
    width: '100%',
  },
  mosaic: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: MOSAIC_OUTER,
    gap: 6,
    marginBottom: spacing.sm,
  },
  wordmark: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
    marginTop: spacing.lg,
  },
  subtitle: {
    ...typography.title,
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 26,
  },
  slideHeading: {
    ...typography.headline,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 30,
  },
  slideBody: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottom: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: 40,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  ctaStack: {
    width: '100%',
    gap: spacing.sm,
    alignItems: 'center',
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  primaryBtnText: {
    ...typography.title,
    color: '#FFFFFF',
  },
  ghostBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: radius.xl,
    alignItems: 'center',
    borderWidth: 1,
  },
  ghostBtnText: {
    ...typography.title,
  },
  nextBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  nextBtnText: {
    ...typography.title,
  },
})
