import { useRef, useState } from 'react'
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
import { theme } from '@/lib/theme'
import { useAlbumStore } from '@/store/albumStore'
import { generateKey, saveEncryptionKey } from '@/lib/secureStore'
import { impactMedium } from '@/lib/haptics'

interface Props {
  visible: boolean
  onClose: () => void
  onCreated: (albumId: string) => void
}

export function CreateAlbumSheet({ visible, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const addAlbum = useAlbumStore((s) => s.addAlbum)
  const inputRef = useRef<TextInput>(null)

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
      await impactMedium()
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
          <View style={styles.handle} />

          <Text style={styles.title}>New Album</Text>

          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Album name"
            placeholderTextColor="#8E8E93"
            value={name}
            onChangeText={setName}
            returnKeyType="done"
            onSubmitEditing={() => { void handleCreate() }}
            autoCorrect={false}
          />

          <View style={styles.row}>
            <View style={styles.rowLabelContainer}>
              <Ionicons name="lock-closed" size={16} color={theme.colors.text} />
              <Text style={styles.rowLabel}>  Private Album</Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ true: '#007AFF' }}
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
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    ...theme.typography.title,
    fontSize: 18,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
    color: theme.colors.text,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceElevated,
    marginBottom: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  rowLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLabel: {
    ...theme.typography.body,
    fontSize: 16,
    color: theme.colors.text,
  },
  biometricHint: {
    ...theme.typography.caption,
    color: theme.colors.textTertiary,
    marginBottom: 20,
  },
  createButton: {
    height: 50,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm + 4,
    marginBottom: theme.spacing.sm,
  },
  createButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  createButtonText: {
    ...theme.typography.title,
    fontSize: 16,
    color: theme.colors.text,
  },
  cancelButton: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    ...theme.typography.body,
    fontSize: 16,
    color: theme.colors.accent,
  },
})
