import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import { usePeopleStore, shouldRescan, type PersonCluster } from '@/store/peopleStore'
import { useSheet } from '@/components/ui/SheetProvider'
import { useTheme } from '@/lib/themeContext'
import { radius, spacing, typography, type ThemeColors } from '@/lib/theme'
import { hapticTap } from '@/lib/haptics'

const SCREEN_WIDTH = Dimensions.get('window').width
const NUM_COLUMNS = 2
const CARD_GAP = 8
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - spacing.md * 2 - CARD_GAP) / NUM_COLUMNS)

function assetUri(assetId: string): string {
  return Platform.OS === 'ios' ? `ph://${assetId}` : assetId
}

function PeopleEmptySvg({ color }: { color: string }) {
  return (
    <Svg width={120} height={120} viewBox="0 0 120 120" fill="none">
      {/* Back person silhouette */}
      <Circle cx={70} cy={38} r={16} stroke={color} strokeWidth={3} />
      <Path
        d="M40 110c0-22 13-36 30-36s30 14 30 36"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* Front person silhouette (overlapping) */}
      <Circle cx={50} cy={42} r={16} stroke={color} strokeWidth={3} />
      <Path
        d="M20 110c0-22 13-36 30-36s30 14 30 36"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Svg>
  )
}

interface PersonCardProps {
  cluster: PersonCluster
  index: number
  colors: ThemeColors
  onRename: (clusterId: string, name: string) => void
}

function PersonCard({ cluster, index, colors, onRename }: PersonCardProps) {
  const router = useRouter()
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameText, setRenameText] = useState(cluster.name ?? '')
  const inputRef = useRef<TextInput>(null)

  const displayName = cluster.name ?? `Person ${String(index + 1)}`

  function handleLongPress() {
    hapticTap()
    setRenameText(cluster.name ?? '')
    setIsRenaming(true)
    setTimeout(() => { inputRef.current?.focus() }, 50)
  }

  function submitRename() {
    const trimmed = renameText.trim()
    if (trimmed.length > 0) {
      onRename(cluster.id, trimmed)
    }
    setIsRenaming(false)
  }

  const cardStyles = useMemo(() => makeCardStyles(colors), [colors])

  return (
    <Pressable
      onPress={() => {
        hapticTap()
        router.push({ pathname: '/people/[id]', params: { id: cluster.id } })
      }}
      onLongPress={handleLongPress}
      delayLongPress={400}
      style={cardStyles.card}
    >
      <Image
        source={{ uri: assetUri(cluster.coverAssetId) }}
        style={cardStyles.coverImage}
        contentFit="cover"
        recyclingKey={cluster.coverAssetId}
        transition={200}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={cardStyles.gradient}
      />
      <View style={cardStyles.overlay}>
        {isRenaming ? (
          <TextInput
            ref={inputRef}
            style={cardStyles.renameInput}
            value={renameText}
            onChangeText={setRenameText}
            onSubmitEditing={submitRename}
            onBlur={submitRename}
            returnKeyType="done"
            autoCorrect={false}
            placeholderTextColor="rgba(255,255,255,0.5)"
            placeholder="Enter name"
          />
        ) : (
          <Text style={cardStyles.nameLabel} numberOfLines={1}>{displayName}</Text>
        )}
        <View style={cardStyles.countBadge}>
          <Text style={cardStyles.countText}>{String(cluster.photoCount)}</Text>
        </View>
      </View>
    </Pressable>
  )
}

export default function PeopleScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { clusters, isScanning, scanProgress, lastScannedAt, startScan, renamePerson, loadClusters } =
    usePeopleStore()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { showConfirm } = useSheet()

  const hasNeverScanned = lastScannedAt === null && !isScanning

  function handleStartScan() {
    void startScan()
  }

  function handleRescan() {
    showConfirm(
      'Re-scan Library',
      'This will re-scan your entire library and may take several minutes.',
      handleStartScan,
      { confirmLabel: 'Scan' },
    )
  }

  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<PersonCluster>) => (
    <PersonCard
      cluster={item}
      index={index}
      colors={colors}
      onRename={(id, name) => { void renamePerson(id, name) }}
    />
  ), [colors, renamePerson])

  const keyExtractor = useCallback((item: PersonCluster) => item.id, [])

  // Load clusters on first render if we have a previous scan
  useEffect(() => {
    void loadClusters()
  }, [])

  return (
    <>
      <Stack.Screen
        options={{
          title: 'People',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerRight: () => (
            <Pressable
              onPress={isScanning ? undefined : (shouldRescan(lastScannedAt) ? handleStartScan : handleRescan)}
              hitSlop={12}
              style={styles.rescanBtn}
            >
              {isScanning
                ? <ActivityIndicator size="small" color={colors.accent} />
                : <Text style={[styles.rescanText, { color: colors.accent }]}>
                    {lastScannedAt === null ? '' : 'Re-scan'}
                  </Text>
              }
            </Pressable>
          ),
        }}
      />

      <View style={[styles.screen, { paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
        {/* Compact scanning banner — shown while scan runs in background */}
        {isScanning && (
          <View style={[styles.scanBanner, { backgroundColor: colors.surfaceElevated }]}>
            <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 8 }} />
            <Text style={[styles.scanBannerText, { color: colors.text }]}>
              Scanning… {String(Math.round(scanProgress))}%
            </Text>
            <View style={[styles.scanBannerBar, { backgroundColor: colors.surface }]}>
              <View style={[styles.scanBannerFill, { width: `${String(Math.round(scanProgress))}%` as `${number}%`, backgroundColor: colors.accent }]} />
            </View>
          </View>
        )}

        {hasNeverScanned ? (
          // ── Never scanned state ──────────────────────────────────────────
          <View style={styles.centered}>
            <PeopleEmptySvg color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>Discover People</Text>
            <Text style={styles.emptyBody}>
              Gathr groups your photos by the people in them — entirely on your device.
            </Text>
            <Pressable style={[styles.scanBtn, { backgroundColor: colors.accent }]} onPress={handleStartScan}>
              <Text style={styles.scanBtnText}>Scan Library</Text>
            </Pressable>
          </View>
        ) : clusters.length === 0 ? (
          // ── No results after scan ────────────────────────────────────────
          <View style={styles.centered}>
            <PeopleEmptySvg color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>No People Found</Text>
            <Text style={styles.emptyBody}>
              No recognizable faces were found. Try scanning again with more photos.
            </Text>
            <Pressable style={[styles.scanBtn, { backgroundColor: colors.accent }]} onPress={handleStartScan}>
              <Text style={styles.scanBtnText}>Scan Again</Text>
            </Pressable>
          </View>
        ) : (
          // ── Results grid ─────────────────────────────────────────────────
          <FlashList
            data={clusters}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={NUM_COLUMNS}
            ListHeaderComponent={
              <Pressable style={[styles.rescanPill, { backgroundColor: colors.surfaceElevated }]} onPress={handleRescan}>
                <Text style={[styles.rescanPillText, { color: colors.accent }]}>Re-scan Library</Text>
              </Pressable>
            }
            contentContainerStyle={{
              padding: spacing.md,
              paddingBottom: insets.bottom + 100,
            }}
          />
        )}
      </View>
    </>
  )
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: 12,
    },
    emptyTitle: {
      ...typography.headline,
      color: colors.text,
      textAlign: 'center',
      marginTop: 8,
    },
    emptyBody: {
      ...typography.body,
      color: colors.textTertiary,
      textAlign: 'center',
      lineHeight: 22,
    },
    scanBtn: {
      marginTop: 8,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 12,
    },
    scanBtnText: {
      color: '#FFFFFF',
      ...typography.title,
    },
    scanBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      gap: 4,
    },
    scanBannerText: {
      ...typography.caption,
      flex: 1,
    },
    scanBannerBar: {
      width: 80,
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
    },
    scanBannerFill: {
      height: '100%',
      borderRadius: 2,
    },
    scanningLabel: {
      ...typography.headline,
      color: colors.text,
      textAlign: 'center',
    },
    scanningSubLabel: {
      ...typography.body,
      color: colors.textTertiary,
      textAlign: 'center',
    },
    progressBar: {
      width: '70%',
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceElevated,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.accent,
      borderRadius: 3,
    },
    progressLabel: {
      ...typography.caption,
      color: colors.textTertiary,
    },
    rescanBtn: {
      paddingRight: 8,
    },
    rescanText: {
      ...typography.body,
    },
    rescanPill: {
      alignSelf: 'flex-end',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      marginBottom: spacing.sm,
    },
    rescanPillText: {
      fontSize: 13,
      fontWeight: '600',
    },
  })
}

function makeCardStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      width: CARD_WIDTH,
      height: CARD_WIDTH,
      borderRadius: radius.md,
      overflow: 'hidden',
      margin: CARD_GAP / 2,
      backgroundColor: colors.surface,
    },
    coverImage: {
      width: CARD_WIDTH,
      height: CARD_WIDTH,
    },
    gradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: CARD_WIDTH / 2,
    },
    overlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      padding: 8,
    },
    nameLabel: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
      marginRight: 4,
    },
    renameInput: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
      marginRight: 4,
      padding: 0,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.5)',
    },
    countBadge: {
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    countText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
    },
  })
}
