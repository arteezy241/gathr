import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Animated, Pressable, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/lib/themeContext'
import { PILL_HEIGHT, PILL_MARGIN_BOTTOM } from '@/components/ui/FloatingTabBar'
import { radius, spacing, typography } from '@/lib/theme'

const AUTO_DISMISS_MS = 4000

interface ToastState {
  id: number
  message: string
  onUndo: () => void
}

interface UndoToastContextValue {
  showToast: (message: string, onUndo: () => void) => void
}

const UndoToastContext = createContext<UndoToastContextValue | null>(null)

interface ToastViewProps {
  toast: ToastState
  translateY: Animated.Value
  opacity: Animated.Value
  onUndo: () => void
}

function ToastView({ toast, translateY, opacity, onUndo }: ToastViewProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const bottomOffset = insets.bottom + PILL_MARGIN_BOTTOM + PILL_HEIGHT + 12

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: bottomOffset,
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      <Text style={[styles.message, { color: colors.text }]} numberOfLines={1}>
        {toast.message}
      </Text>
      <Pressable onPress={onUndo} hitSlop={8} style={styles.undoButton}>
        <Text style={[styles.undoText, { color: colors.accent }]}>Undo</Text>
      </Pressable>
    </Animated.View>
  )
}

export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const idRef = useRef(0)
  const translateY = useRef(new Animated.Value(80)).current
  const opacity = useRef(new Animated.Value(0)).current
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    Animated.parallel([
      Animated.timing(translateY, { toValue: 80, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => { setToast(null) })
  }, [translateY, opacity])

  const showToast = useCallback((message: string, onUndo: () => void) => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const id = ++idRef.current
    setToast({ id, message, onUndo })
    translateY.setValue(80)
    opacity.setValue(0)
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 20,
        bounciness: 4,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start()
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS)
  }, [translateY, opacity, dismiss])

  return (
    <UndoToastContext.Provider value={{ showToast }}>
      {children}
      {toast !== null && (
        <ToastView
          toast={toast}
          translateY={translateY}
          opacity={opacity}
          onUndo={() => {
            toast.onUndo()
            dismiss()
          }}
        />
      )}
    </UndoToastContext.Provider>
  )
}

export function useUndoToast(): UndoToastContextValue {
  const ctx = useContext(UndoToastContext)
  if (ctx === null) throw new Error('useUndoToast must be used within UndoToastProvider')
  return ctx
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    gap: spacing.sm,
  },
  message: {
    ...typography.body,
    flex: 1,
  },
  undoButton: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  undoText: {
    ...typography.bodyMedium,
  },
})
