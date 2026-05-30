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
            <Text style={styles.rowLabel}>
              {'🔒  '}Private Album
            </Text>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#000000',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#000000',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: 16,
    color: '#000000',
  },
  biometricHint: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 20,
  },
  createButton: {
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  createButtonDisabled: {
    backgroundColor: '#A8A8AD',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  cancelButton: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
})
