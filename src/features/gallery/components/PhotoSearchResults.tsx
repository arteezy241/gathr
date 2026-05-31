import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { type MediaLibraryAsset, getPhotosByDateRange } from '@/lib/mediaLibrary'
import { useTheme } from '@/lib/themeContext'
import { PhotoThumb, THUMB_SIZE } from './PhotoThumb'
import { useSelectionStore } from '@/store/selectionStore'

const NUM_COLUMNS = 3

interface PhotoRow {
  assets: MediaLibraryAsset[]
  rowIndex: number
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function parseDateRange(query: string): { startMs: number; endMs: number; label: string } | null {
  const q = query.trim()

  // "2024"
  if (/^\d{4}$/.test(q)) {
    const year = parseInt(q, 10)
    if (year < 1900 || year > new Date().getFullYear() + 1) return null
    return {
      startMs: new Date(year, 0, 1).getTime(),
      endMs: new Date(year, 11, 31, 23, 59, 59, 999).getTime(),
      label: q,
    }
  }

  // "Jan 2024" / "January 2024" / "2024 Jan"
  const monthYearFwd = /^([a-z]+)\s+(\d{4})$/i.exec(q)
  const monthYearRev = /^(\d{4})\s+([a-z]+)$/i.exec(q)
  const match = monthYearFwd ?? monthYearRev
  if (match !== null) {
    const [, a, b] = match
    const [monthStr, yearStr] = /^\d+$/.test(a ?? '') ? [b, a] : [a, b]
    const monthIdx = MONTHS.indexOf((monthStr ?? '').toLowerCase().slice(0, 3))
    const year = parseInt(yearStr ?? '', 10)
    if (monthIdx === -1 || isNaN(year) || year < 1900) return null
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
    return {
      startMs: new Date(year, monthIdx, 1).getTime(),
      endMs: new Date(year, monthIdx + 1, 0, 23, 59, 59, 999).getTime(),
      label: `${monthNames[monthIdx] ?? ''} ${String(year)}`,
    }
  }

  return null
}

interface Props {
  query: string
  contentBottomPad: number
}

export function PhotoSearchResults({ query, contentBottomPad }: Props) {
  const router = useRouter()
  const { colors } = useTheme()
  const { selectedIds, isSelecting, toggleSelect, setLastSelected } = useSelectionStore()
  const selectedIdsSnapshot = useMemo(() => selectedIds, [selectedIds])

  const [results, setResults] = useState<MediaLibraryAsset[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchLabel, setSearchLabel] = useState<string | null>(null)
  const [noMatch, setNoMatch] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setSearchLabel(null)
      setNoMatch(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      const range = parseDateRange(trimmed)
      if (range === null) {
        setResults([])
        setSearchLabel(null)
        setNoMatch(true)
        return
      }
      setIsLoading(true)
      setNoMatch(false)
      void getPhotosByDateRange(range.startMs, range.endMs, 500).then((photos) => {
        setResults(photos)
        setSearchLabel(range.label)
        setIsLoading(false)
      })
    }, 350)

    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current)
    }
  }, [query])

  const rows = useMemo<PhotoRow[]>(() => {
    const out: PhotoRow[] = []
    for (let i = 0; i < results.length; i += NUM_COLUMNS) {
      out.push({ assets: results.slice(i, i + NUM_COLUMNS), rowIndex: i / NUM_COLUMNS })
    }
    return out
  }, [results])

  const allAssetIds = useMemo(() => results.map((a) => a.id), [results])

  const renderRow = useCallback(({ item }: ListRenderItemInfo<PhotoRow>) => (
    <View style={styles.row}>
      {item.assets.map((asset) => (
        <PhotoThumb
          key={asset.id}
          asset={asset}
          isSelected={selectedIdsSnapshot.has(asset.id)}
          allAssetIds={allAssetIds}
          onPress={() => {
            if (isSelecting) { toggleSelect(asset.id); setLastSelected(asset.id) }
            else { router.push({ pathname: '/photo/[id]', params: { id: asset.id, context: 'gallery' } }) }
          }}
          onLongPress={() => {}}
        />
      ))}
      {item.assets.length < NUM_COLUMNS &&
        Array.from({ length: NUM_COLUMNS - item.assets.length }).map((_, i) => (
          <View key={`empty-${String(i)}`} style={styles.placeholder} />
        ))}
    </View>
  ), [selectedIdsSnapshot, allAssetIds, isSelecting, toggleSelect, setLastSelected, router])

  if (query.trim().length < 2) {
    return (
      <View style={styles.hint}>
        <Text style={[styles.hintTitle, { color: colors.text }]}>Search by date</Text>
        <Text style={[styles.hintBody, { color: colors.textTertiary }]}>
          Try "2024", "January 2024", or "Jan 2023"
        </Text>
      </View>
    )
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (noMatch) {
    return (
      <View style={styles.hint}>
        <Text style={[styles.hintTitle, { color: colors.text }]}>No results</Text>
        <Text style={[styles.hintBody, { color: colors.textTertiary }]}>
          Try a year like "2024" or a month like "March 2023"
        </Text>
      </View>
    )
  }

  if (results.length === 0 && searchLabel !== null) {
    return (
      <View style={styles.hint}>
        <Text style={[styles.hintTitle, { color: colors.text }]}>No photos in {searchLabel}</Text>
        <Text style={[styles.hintBody, { color: colors.textTertiary }]}>
          Try a different date range
        </Text>
      </View>
    )
  }

  return (
    <FlashList
      data={rows}
      renderItem={renderRow}
      keyExtractor={(item) => `row-${item.assets[0]?.id ?? String(item.rowIndex)}`}
      extraData={selectedIdsSnapshot}
      contentContainerStyle={{ paddingBottom: contentBottomPad }}
      ListHeaderComponent={
        searchLabel !== null ? (
          <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>
            {String(results.length)} photo{results.length !== 1 ? 's' : ''} in {searchLabel}
          </Text>
        ) : null
      }
    />
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    columnGap: 2,
    marginBottom: 2,
  },
  placeholder: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  hint: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  hintTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  hintBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  resultLabel: {
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
})
