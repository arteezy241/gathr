import { useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAlbumStore } from '@/store/albumStore'
import { generateKey, saveEncryptionKey } from '@/lib/secureStore'
import { hapticSuccess, hapticSoft } from '@/lib/haptics'
import { useTheme } from '@/lib/themeContext'
import { GlassView } from '@/components/ui/GlassView'
import { radius, spacing, typography, type ThemeColors } from '@/lib/theme'

interface Props {
  visible: boolean
  onClose: () => void
  onCreated: (albumId: string) => void
}

export function CreateAlbumSheet({ visible, onClose, onCreated }: Props) {
  const { colors } = useTheme()
  const [name, setName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const addAlbum = useAlbumStore((s) => s.addAlbum)
  const inputRef = useRef<TextInput>(null)

  const styles = useMemo(() => makeStyles(colors), [colors])

  function handleClose() {
    setName('')
    setIsPrivate(false)
    onClose()
  }

  async function handleCreate() {
    const trimmed = name.trim()
    if (trimmed.length === 0 || isSubmitting) return
    setIsSubmitting(true)
    try {
      const id = await addAlbum(trimmed, isPrivate)
      if (isPrivate) {
        await saveEncryptionKey(id, generateKey())
      }
      hapticSuccess()
      setName('')
      setIsPrivate(false)
      onCreated(id)
    } finally {
      setIsSubmitting(false)
    }
  }

  const canCreate = name.trim().length > 0 && !isSubmitting

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      onShow={() => { inputRef.current?.focus() }}
    >
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetWrapper}
        pointerEvents="box-none"
      >
        <View style={styles.sheet}>
          <GlassView intensity={70} style={StyleSheet.absoluteFill} />

          <View style={styles.sheetContent}>
            <View style={styles.handle} />

            <Text style={styles.title}>New Album</Text>

            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Album name"
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              onSubmitEditing={() => { void handleCreate() }}
              autoCorrect={false}
            />

            <View style={styles.row}>
              <View style={styles.rowLabelContainer}>
                <Ionicons name="lock-closed" size={16} color={colors.text} />
                <Text style={styles.rowLabel}>  Private Album</Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ true: colors.accent }}
              />
            </View>

            {isPrivate && (
              <Text style={styles.biometricHint}>Protected with biometrics</Text>
            )}

            <Pressable
              style={[styles.createButton, !canCreate && styles.createButtonDisabled]}
              onPress={() => { void handleCreate() }}
              disabled={!canCreate}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.createButtonText}>Create</Text>
              )}
            </Pressable>

            <Pressable style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheetWrapper: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      overflow: 'hidden',
    },
    sheetContent: {
      paddingHorizontal: 20,
      paddingBottom: 36,
      paddingTop: 12,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 20,
    },
    title: {
      ...typography.title,
      fontSize: 18,
      marginBottom: spacing.md,
      textAlign: 'center',
      color: colors.text,
    },
    input: {
      height: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surfaceElevated,
      marginBottom: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    rowLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    rowLabel: {
      ...typography.body,
      fontSize: 16,
      color: colors.text,
    },
    biometricHint: {
      ...typography.caption,
      color: colors.textTertiary,
      marginBottom: 20,
    },
    createButton: {
      height: 50,
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm + 4,
      marginBottom: spacing.sm,
    },
    createButtonDisabled: {
      backgroundColor: colors.border,
    },
    createButtonText: {
      ...typography.title,
      fontSize: 16,
      color: '#FFFFFF',
    },
    cancelButton: {
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButtonText: {
      ...typography.body,
      fontSize: 16,
      color: colors.accent,
    },
  })
}
