import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Keyboard,
  type KeyboardEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNotesStore } from '@/store/notesStore'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const SHEET_H = Math.min(498, SCREEN_HEIGHT * 0.6)
const PEEK_H = 58

const AC = '#A488BE'
const AC_BG = 'rgba(164,136,190,0.18)'
const FG = '#FFFFFF'
const FG2 = 'rgba(235,235,245,0.55)'
const FG3 = 'rgba(235,235,245,0.28)'
const SHEET_BG = 'rgba(9,7,14,0.94)'

interface PhotoNotesSheetProps {
  assetId: string
  photoDate?: string | undefined
  photoTime?: string | undefined
  locationName?: string | undefined
  fileInfo?: string | undefined
  resolution?: string | undefined
  onDimChange?: (dimmed: boolean) => void
}

function TagChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View style={styles.tagChip}>
      <Text style={styles.tagChipText}>{label}</Text>
      <Pressable onPress={onRemove} hitSlop={6} style={styles.tagChipRemove}>
        <Ionicons name="close" size={11} color={AC} />
      </Pressable>
    </View>
  )
}

function AddTagChip({ onAdd }: { onAdd: (tag: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const inputRef = useRef<TextInput>(null)

  function commit() {
    if (val.trim()) onAdd(val.trim())
    setVal('')
    setEditing(false)
  }

  if (editing) {
    return (
      <View style={styles.tagChipEditing}>
        <TextInput
          ref={inputRef}
          autoFocus
          value={val}
          onChangeText={setVal}
          onSubmitEditing={commit}
          onBlur={commit}
          placeholder="tag name"
          placeholderTextColor={FG3}
          returnKeyType="done"
          style={styles.tagChipInput}
        />
      </View>
    )
  }

  return (
    <Pressable style={styles.addTagChip} onPress={() => setEditing(true)}>
      <Ionicons name="add" size={12} color={FG3} />
      <Text style={styles.addTagText}>Add tag</Text>
    </Pressable>
  )
}

export function PhotoNotesSheet({
  assetId,
  photoDate,
  photoTime,
  locationName,
  fileInfo,
  resolution,
  onDimChange,
}: PhotoNotesSheetProps) {
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [localNote, setLocalNote] = useState('')
  const translateY = useRef(new Animated.Value(SHEET_H - PEEK_H)).current
  const keyboardH = useRef(new Animated.Value(0)).current

  useEffect(() => {
    function onShow(e: KeyboardEvent) {
      Animated.timing(keyboardH, { toValue: -e.endCoordinates.height, duration: 220, useNativeDriver: true }).start()
    }
    function onHide() {
      Animated.timing(keyboardH, { toValue: 0, duration: 180, useNativeDriver: true }).start()
    }
    const show = Keyboard.addListener('keyboardDidShow', onShow)
    const hide = Keyboard.addListener('keyboardDidHide', onHide)
    return () => { show.remove(); hide.remove() }
  }, [keyboardH])

  const { notes, tags, loadNote, saveNote, loadTags, addTag, removeTag } = useNotesStore()
  const assetNote = notes[assetId] ?? ''
  const assetTags = tags[assetId] ?? []

  // Load on mount
  useEffect(() => {
    void loadNote(assetId)
    void loadTags(assetId)
  }, [assetId, loadNote, loadTags])

  // Sync local note input from store
  useEffect(() => {
    setLocalNote(assetNote)
  }, [assetNote])

  const expand = useCallback(() => {
    setExpanded(true)
    onDimChange?.(true)
    Animated.spring(translateY, {
      toValue: 0,
      damping: 40,
      stiffness: 320,
      useNativeDriver: true,
    }).start()
  }, [translateY, onDimChange])

  const collapse = useCallback(() => {
    Keyboard.dismiss()
    setExpanded(false)
    onDimChange?.(false)
    Animated.spring(translateY, {
      toValue: SHEET_H - PEEK_H,
      damping: 40,
      stiffness: 320,
      useNativeDriver: true,
    }).start()
  }, [translateY, onDimChange])

  // Drag gesture on the handle / peek area
  const dragStartY = useRef(0)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: (e) => {
        dragStartY.current = e.nativeEvent.pageY
      },
      onPanResponderRelease: (e) => {
        const dy = e.nativeEvent.pageY - dragStartY.current
        if (dy > 32) collapse()
        else if (dy < -32) expand()
      },
    }),
  ).current

  function handleSave() {
    void saveNote(assetId, localNote)
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  const metaRows = [
    photoDate ? { label: 'Date', value: photoDate } : null,
    photoTime ? { label: 'Time', value: photoTime } : null,
    locationName ? { label: 'Location', value: locationName } : null,
    fileInfo ? { label: 'File', value: fileInfo } : null,
    resolution ? { label: 'Resolution', value: resolution, mono: true } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; mono?: boolean }>

  return (
    <Animated.View style={[styles.outerSheet, { transform: [{ translateY: keyboardH }] }]}>
    <Animated.View
      style={[styles.sheet, { transform: [{ translateY }] }]}
    >
      {/* Drag handle area */}
      <View {...panResponder.panHandlers} style={styles.handleArea}>
        <View style={styles.handle} />
      </View>

      {/* Peek line — always visible */}
      <Pressable
        style={styles.peekRow}
        onPress={expanded ? collapse : expand}
        {...(!expanded ? panResponder.panHandlers : {})}
      >
        {photoDate ? (
          <Text style={styles.peekDate}>{photoDate.split(',').slice(0, 2).join(',')}</Text>
        ) : null}
        {locationName ? (
          <>
            <Text style={styles.peekDot}>·</Text>
            <Ionicons name="location-outline" size={11} color={FG3} />
            <Text style={styles.peekLocation}>{locationName}</Text>
          </>
        ) : null}
      </Pressable>

      {/* Expanded content */}
      {expanded && (
        <ScrollView
          style={styles.expandedContent}
          contentContainerStyle={styles.expandedInner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.divider} />

          {/* Metadata */}
          {metaRows.length > 0 && (
            <View style={styles.metaBlock}>
              {metaRows.map((row) => (
                <View key={row.label} style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{row.label}</Text>
                  <Text style={[styles.metaValue, row.mono && styles.metaMono]} numberOfLines={1}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.divider} />

          {/* Note */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={14} color={FG3} />
              <Text style={styles.sectionLabel}>NOTE</Text>
            </View>
            <TextInput
              value={localNote}
              onChangeText={setLocalNote}
              placeholder="Add a note…"
              placeholderTextColor={FG3}
              multiline
              numberOfLines={3}
              style={styles.noteInput}
              selectionColor={AC}
            />
          </View>

          <View style={styles.divider} />

          {/* Tags */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="pricetag-outline" size={14} color={FG3} />
              <Text style={styles.sectionLabel}>TAGS</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagScroll}
            >
              {assetTags.map((tag) => (
                <TagChip
                  key={tag}
                  label={tag}
                  onRemove={() => { void removeTag(assetId, tag) }}
                />
              ))}
              <AddTagChip onAdd={(tag) => { void addTag(assetId, tag) }} />
            </ScrollView>
          </View>

          {/* Save button */}
          <View style={styles.saveRow}>
            <Pressable
              style={[styles.saveButton, saved && styles.saveButtonSaved]}
              onPress={handleSave}
            >
              {saved ? (
                <>
                  <Ionicons name="checkmark" size={13} color={AC} />
                  <Text style={[styles.saveText, styles.saveTextSaved]}>Saved</Text>
                </>
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      )}
    </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  outerSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_H,
  },
  sheet: {
    height: SHEET_H,
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
    zIndex: 20,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius: 2,
  },
  peekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingBottom: 14,
  },
  peekDate: {
    color: FG2,
    fontSize: 13,
    fontWeight: '400',
  },
  peekDot: {
    color: FG3,
    fontSize: 13,
  },
  peekLocation: {
    color: FG3,
    fontSize: 13,
  },
  expandedContent: {
    flex: 1,
  },
  expandedInner: {
    paddingBottom: 32,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 22,
    marginBottom: 18,
  },
  metaBlock: {
    paddingHorizontal: 22,
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 5,
  },
  metaLabel: {
    color: FG3,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.1,
    flexShrink: 0,
    marginRight: 12,
  },
  metaValue: {
    color: FG2,
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'right',
    flexShrink: 1,
  },
  metaMono: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  section: {
    paddingHorizontal: 22,
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  sectionLabel: {
    color: FG3,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  noteInput: {
    color: FG,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24.75,
    letterSpacing: 0.1,
    textAlignVertical: 'top',
    minHeight: 72,
  },
  tagScroll: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: AC_BG,
    borderWidth: 1,
    borderColor: 'rgba(164,136,190,0.35)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 13,
    paddingRight: 10,
  },
  tagChipText: {
    color: AC,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  tagChipRemove: {
    marginLeft: 2,
  },
  tagChipEditing: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AC_BG,
    borderWidth: 1,
    borderColor: 'rgba(164,136,190,0.35)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 13,
    minWidth: 80,
  },
  tagChipInput: {
    color: AC,
    fontSize: 13,
    fontWeight: '500',
    minWidth: 70,
  },
  addTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 13,
  },
  addTagText: {
    color: FG3,
    fontSize: 13,
    fontWeight: '400',
  },
  saveRow: {
    paddingHorizontal: 22,
    paddingTop: 4,
    alignItems: 'flex-end',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(164,136,190,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(164,136,190,0.28)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 22,
  },
  saveButtonSaved: {
    backgroundColor: 'rgba(164,136,190,0.22)',
  },
  saveText: {
    color: AC,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  saveTextSaved: {
    color: 'rgba(164,136,190,0.65)',
  },
})
